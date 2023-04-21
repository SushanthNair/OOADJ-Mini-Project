var Sudoku = ( function ( $ ){
	var _instance, _game,
		/**
		 * Default configuration options. These can be overriden
		 * when loading a game instance.
		 * @property {Object}
		 */
		defaultConfig = {
			'validate_on_insert': true,
			'show_solver_timer': true,
			'show_recursion_counter': true,
			'solver_shuffle_numbers': true
		},
		paused = false,
		counter = 0;

	/**
	 * Initialize the singleton
	 * @param {Object} config Configuration options
	 * @returns {Object} Singleton methods
	 */
	function init( config ) {
		conf = $.extend( {}, defaultConfig, config );
		_game = new Game( conf );

		/** Public methods **/
		return {
			/**
			 * Return a visual representation of the board
			 * @returns {jQuery} Game table
			 */
			getGameBoard: function() {
				return _game.buildGUI();
			},

			/**
			 * Reset the game board.
			 */
			reset: function() {
				_game.resetGame();
			},

			generate: function(){
				_game.generatePuzzle();
			},
			hint: function() {
				_game.hintGame();
			},
			/**
			 * Call for a validation of the game board.
			 * @returns {Boolean} Whether the board is valid
			 */
			validate: function() {
				var isValid;

				isValid = _game.validateMatrix();
				$( '.sudoku-container' ).toggleClass( 'valid-matrix', isValid );
			},

			/**
			 * Call for the solver routine to solve the current
			 * board.
			 */
			solve: function() {
				var isValid, starttime, endtime, elapsed;
				// Make sure the board is valid first
				if ( !_game.validateMatrix() ) {
					return false;
				}
				// Reset counters
				_game.recursionCounter = 0;
				_game.backtrackCounter = 0;

				// Check start time
				starttime = Date.now();

				// Solve the game
				isValid = _game.solveGame( 0, 0 );

				// Get solving end time
				endtime = Date.now();

				// Visual indication of whether the game was solved
				$( '.sudoku-container' ).toggleClass( 'valid-matrix', isValid );
				if ( isValid ) {
					$( '.valid-matrix input' ).attr( 'disabled', 'disabled' );
				}

				// Display elapsed time
				if ( _game.config.show_solver_timer ) {
					elapsed = endtime - starttime;
					window.console.log( 'Solver elapsed time: ' + elapsed + 'ms' );
				}
				// Display number of reursions and backtracks
				if ( _game.config.show_recursion_counter ) {
					window.console.log( 'Solver recursions: ' + _game.recursionCounter );
					window.console.log( 'Solver backtracks: ' + _game.backtrackCounter );
				}
			}
		};
	}

	/**
	 * Sudoku singleton engine
	 * @param {Object} config Configuration options
	 */
	function Game( config ) {
		this.config = config;

		// Initialize game parameters
		this.recursionCounter = 0;
		this.$cellMatrix = {};
		this.matrix = {};
		this.validation = {};

		this.resetValidationMatrices();
		return this;
	}
	/**
	 * Game engine prototype methods
	 * @property {Object}
	 */
	Game.prototype = {
		/**
		 * Build the game GUI
		 * @returns {jQuery} Table containing 9x9 input matrix
		 */
		buildGUI: function() {
			var $td, $tr,
				$table = $( '<table>' )
					.addClass( 'sudoku-container' );

			for ( var i = 0; i < 9; i++ ) {
				$tr = $( '<tr>' );
				this.$cellMatrix[i] = {};

				for ( var j = 0; j < 9; j++ ) {
					// Build the input
					this.$cellMatrix[i][j] = $( '<input>' )
						.attr( 'maxlength', 1 )
						.data( 'row', i )
						.data( 'col', j )
						.on( 'keyup', $.proxy( this.onKeyUp, this ) );

					$td = $( '<td>' ).append( this.$cellMatrix[i][j] );
					// Calculate section ID
					sectIDi = Math.floor( i / 3 );
					sectIDj = Math.floor( j / 3 );
					// Set the design for different sections
					if ( ( sectIDi + sectIDj ) % 2 === 0 ) {
						$td.addClass( 'sudoku-section-one' );
					} else {
						$td.addClass( 'sudoku-section-two' );
					}
					// Build the row
					$tr.append( $td );
				}
				// Append to table
				$table.append( $tr );
			}
			// Return the GUI table
			return $table;
		},

		/**
		 * Handle keyup events.
		 *
		 * @param {jQuery.event} e Keyup event
		 */
		onKeyUp: function( e ) {
			var sectRow, sectCol, secIndex,
				starttime, endtime, elapsed,
				isValid = true,
				val = $.trim( $( e.currentTarget ).val() ),
				row = $( e.currentTarget ).data( 'row' ),
				col = $( e.currentTarget ).data( 'col' );

			// Reset board validation class
			$( '.sudoku-container' ).removeClass( 'valid-matrix' );

			// Validate, but only if validate_on_insert is set to true
			if ( this.config.validate_on_insert ) {
				isValid = this.validateNumber( val, row, col, this.matrix.row[row][col] );
				// Indicate error
				$( e.currentTarget ).toggleClass( 'sudoku-input-error', !isValid );
			}

			// Calculate section identifiers
			sectRow = Math.floor( row / 3 );
			sectCol = Math.floor( col / 3 );
			secIndex = ( row % 3 ) * 3 + ( col % 3 );

			// Cache value in matrix
			this.matrix.row[row][col] = val;
			this.matrix.col[col][row] = val;
			this.matrix.sect[sectRow][sectCol][secIndex] = val;
		},

		/**
		 * Reset the board and the game parameters
		 */
		resetGame: function() {
			this.resetValidationMatrices();
			for ( var row = 0; row < 9; row++ ) {
				for ( var col = 0; col < 9; col++ ) {
					// Reset GUI inputs
					this.$cellMatrix[row][col].val( '' );
				}
			}

			$( '.sudoku-container input' ).removeAttr( 'disabled' );
			$( '.sudoku-container' ).removeClass( 'valid-matrix' );
		},

		/**
		 * Reset and rebuild the validation matrices
		 */
		resetValidationMatrices: function() {
			this.matrix = { 'row': {}, 'col': {}, 'sect': {} };
			this.validation = { 'row': {}, 'col': {}, 'sect': {} };

			// Build the row/col matrix and validation arrays
			for ( var i = 0; i < 9; i++ ) {
				this.matrix.row[i] = [ '', '', '', '', '', '', '', '', '' ];
				this.matrix.col[i] = [ '', '', '', '', '', '', '', '', '' ];
				this.validation.row[i] = [];
				this.validation.col[i] = [];
			}

			// Build the section matrix and validation arrays
			for ( var row = 0; row < 3; row++ ) {
				this.matrix.sect[row] = [];
				this.validation.sect[row] = {};
				for ( var col = 0; col < 3; col++ ) {
					this.matrix.sect[row][col] = [ '', '', '', '', '', '', '', '', '' ];
					this.validation.sect[row][col] = [];
				}
			}
		},

		/**
		 * Validate the current number that was inserted.
		 *
		 * @param {String} num The value that is inserted
		 * @param {Number} rowID The row the number belongs to
		 * @param {Number} colID The column the number belongs to
		 * @param {String} oldNum The previous value
		 * @returns {Boolean} Valid or invalid input
		 */
		hintGame: function(){
			var iter = 1, row = getRandomInt(0,8), col = getRandomInt(0,8);
					var $nextSquare
					$nextSquare = this.findClosestEmptySquare( row , col );
					if ( !$nextSquare ) {
						// End of board
						return true;
					} else {
						sqRow = $nextSquare.data( 'row' );
						sqCol = $nextSquare.data( 'col' );
						legalValues = this.findLegalValuesForSquare( sqRow, sqCol );
		
						// Find the segment id
						sectRow = Math.floor( sqRow / 3 );
						sectCol = Math.floor( sqCol / 3 );
						secIndex = ( sqRow % 3 ) * 3 + ( sqCol % 3 );
	
					var randNum = getRandomInt(1,8);
					$nextSquare.val( randNum );
					this.matrix.row[row][col] = randNum;
					this.matrix.col[col][row] = randNum;
					this.matrix.sect[sectRow][sectCol][secIndex] = randNum;
					row = getRandomInt(0,9);
					col = getRandomInt(0,9);
				}
	
			console.log("Hint Generated");
		},
		validateNumber: function( num, rowID, colID, oldNum ) {
			var isValid = true,
				// Section
				sectRow = Math.floor( rowID / 3 ),
				sectCol = Math.floor( colID / 3 );
			oldNum = oldNum || '';

			// Remove oldNum from the validation matrices,
			// if it exists in them.
			if ( this.validation.row[rowID].indexOf( oldNum ) > -1 ) {
				this.validation.row[rowID].splice(
					this.validation.row[rowID].indexOf( oldNum ), 1
				);
			}
			if ( this.validation.col[colID].indexOf( oldNum ) > -1 ) {
				this.validation.col[colID].splice(
					this.validation.col[colID].indexOf( oldNum ), 1
				);
			}
			if ( this.validation.sect[sectRow][sectCol].indexOf( oldNum ) > -1 ) {
				this.validation.sect[sectRow][sectCol].splice(
					this.validation.sect[sectRow][sectCol].indexOf( oldNum ), 1
				);
			}
			// Skip if empty value

			if ( num !== '' ) {


				// Validate value
				if (
					// Make sure value is numeric
					$.isNumeric( num ) &&
					// Make sure value is within range
					Number( num ) > 0 &&
					Number( num ) <= 9
				) {
					// Check if it already exists in validation array
					if (
						$.inArray( num, this.validation.row[rowID] ) > -1 ||
						$.inArray( num, this.validation.col[colID] ) > -1 ||
						$.inArray( num, this.validation.sect[sectRow][sectCol] ) > -1
					) {
						isValid = false;
					} else {
						isValid = true;
					}
				}
				this.validation.row[rowID].push( num );
				this.validation.col[colID].push( num );
				this.validation.sect[sectRow][sectCol].push( num );
			}

			return isValid;
		},

		/**
		 * Validate the entire matrix
		 * @returns {Boolean} Valid or invalid matrix
		 */
		validateMatrix: function() {
			var isValid, val, $element,
				hasError = false;

			// Go over entire board, and compare to the cached
			// validation arrays
			for ( var row = 0; row < 9; row++ ) {
				for ( var col = 0; col < 9; col++ ) {
					val = this.matrix.row[row][col];
					// Validate the value
					isValid = this.validateNumber( val, row, col, val );
					this.$cellMatrix[row][col].toggleClass( 'sudoku-input-error', !isValid );
					if ( !isValid ) {
						hasError = true;
					}
				}
			}
			return !hasError;
		},

		solveGame: function( row, col ) {
			var cval, sqRow, sqCol, $nextSquare, legalValues,
				sectRow, sectCol, secIndex, gameResult;

			this.recursionCounter++;
			$nextSquare = this.findClosestEmptySquare( row, col );
			if ( !$nextSquare ) {
				// End of board
				return true;
			} else {
				sqRow = $nextSquare.data( 'row' );
				sqCol = $nextSquare.data( 'col' );
				legalValues = this.findLegalValuesForSquare( sqRow, sqCol );

				// Find the segment id
				sectRow = Math.floor( sqRow / 3 );
				sectCol = Math.floor( sqCol / 3 );
				secIndex = ( sqRow % 3 ) * 3 + ( sqCol % 3 );

				// Try out legal values for this cell
				for ( var i = 0; i < legalValues.length; i++ ) {
					cval = legalValues[i];
					// Update value in input
					$nextSquare.val( cval );
					// Update in matrices
					this.matrix.row[sqRow][sqCol] = cval;
					this.matrix.col[sqCol][sqRow] = cval;
					this.matrix.sect[sectRow][sectCol][secIndex] = cval;

					// Recursively keep trying
					if ( this.solveGame( sqRow, sqCol ) ) {
						return true;
					} else {
						// There was a problem, we should backtrack
						this.backtrackCounter++;

						// Remove value from input
						this.$cellMatrix[sqRow][sqCol].val( '' );
						// Remove value from matrices
						this.matrix.row[sqRow][sqCol] = '';
						this.matrix.col[sqCol][sqRow] = '';
						this.matrix.sect[sectRow][sectCol][secIndex] = '';
					}
				}
				// If there was no success with any of the legal numbers, call backtrack recursively backwards
				return false;
			}
		},
		generatePuzzle: function(){
				var iter = 5, row = 0, col = 0;
				console.log("Generati8ng Puzzle");
				while(iter-- >= 0)
				{	
					var $nextSquare
					$nextSquare = this.findClosestEmptySquare( row , col );
					if ( !$nextSquare ) {
						// End of board
						return true;
					} else {
						sqRow = $nextSquare.data( 'row' );
						sqCol = $nextSquare.data( 'col' );
						legalValues = this.findLegalValuesForSquare( sqRow, sqCol );
		
						// Find the segment id
						sectRow = Math.floor( sqRow / 3 );
						sectCol = Math.floor( sqCol / 3 );
						secIndex = ( sqRow % 3 ) * 3 + ( sqCol % 3 );
	
					var randNum = getRandomInt(1,8);
					$nextSquare.val( randNum );
					this.matrix.row[row][col] = randNum;
					this.matrix.col[col][row] = randNum;
					this.matrix.sect[sectRow][sectCol][secIndex] = randNum;
					row = getRandomInt(1,8);
					col = getRandomInt(1,8);
				}
	
			}
			console.log("Generated puzzle");
		},
		/**
		 * Find closest empty square relative to the given cell.
		 *
		 * @param {Number} row Row id
		 * @param {Number} col Column id
		 * @returns {jQuery} Input element of the closest empty
		 *  square
		 */
		findClosestEmptySquare: function( row, col ) {
			var walkingRow, walkingCol, found = false;
			for ( var i = ( col + 9*row ); i < 81; i++ ) {
				walkingRow = Math.floor( i / 9 );
				walkingCol = i % 9;
				if ( this.matrix.row[walkingRow][walkingCol] === '' ) {
					found = true;
					return this.$cellMatrix[walkingRow][walkingCol];
				}
			}
		},

		/**
		 * Find the available legal numbers for the square in the
		 * given row and column.
		 *
		 * @param {Number} row Row id
		 * @param {Number} col Column id
		 * @returns {Array} An array of available numbers
		 */
		findLegalValuesForSquare: function( row, col ) {
			var legalVals, legalNums, val, i,
				sectRow = Math.floor( row / 3 ),
				sectCol = Math.floor( col / 3 );

			legalNums = [ 1, 2, 3, 4, 5, 6, 7, 8, 9];

			// Check existing numbers in col
			for ( i = 0; i < 9; i++ ) {
				val = Number( this.matrix.col[col][i] );
				if ( val > 0 ) {
					// Remove from array
					if ( legalNums.indexOf( val ) > -1 ) {
						legalNums.splice( legalNums.indexOf( val ), 1 );
					}
				}
			}

			// Check existing numbers in row
			for ( i = 0; i < 9; i++ ) {
				val = Number( this.matrix.row[row][i] );
				if ( val > 0 ) {
					// Remove from array
					if ( legalNums.indexOf( val ) > -1 ) {
						legalNums.splice( legalNums.indexOf( val ), 1 );
					}
				}
			}

			// Check existing numbers in section
			sectRow = Math.floor( row / 3 );
			sectCol = Math.floor( col / 3 );
			for ( i = 0; i < 9; i++ ) {
				val = Number( this.matrix.sect[sectRow][sectCol][i] );
				if ( val > 0 ) {
					// Remove from array
					if ( legalNums.indexOf( val ) > -1 ) {
						legalNums.splice( legalNums.indexOf( val ), 1 );
					}
				}
			}

			if ( this.config.solver_shuffle_numbers ) {
				// Shuffling the resulting 'legalNums' array will
				// make sure the solver produces different answers
				// for the same scenario. Otherwise, 'legalNums'
				// will be chosen in sequence.
				for ( i = legalNums.length - 1; i > 0; i-- ) {
					var rand = getRandomInt( 0, i );
					temp = legalNums[i];
					legalNums[i] = legalNums[rand];
					legalNums[rand] = temp;
				}
			}

			return legalNums;
		},
	};

	/**
	 * Get a random integer within a range
	 *
	 * @param {Number} min Minimum number
	 * @param {Number} max Maximum range
	 * @returns {Number} Random number within the range (Inclusive)
	 */
	function getRandomInt(min, max) {
		return Math.floor( Math.random() * ( max + 1 ) ) + min;
	}

	return {
		/**
		 * Get the singleton instance. Only one instance is allowed.
		 * The method will either create an instance or will return
		 * the already existing instance.
		 *
		 * @param {[type]} config [description]
		 * @returns {[type]} [description]
		 */
		getInstance: function( config ) {
			if ( !_instance ) {
				_instance = init( config );
			}
			return _instance;
		}
	};
} )( jQuery );