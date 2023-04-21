package net.miniproject.sudokusolver;

import java.util.ArrayList;
import java.util.List;

public class ContactBusiness {
    public List<Contact> getContactList() {
        List<Contact> listContact = new ArrayList<>();
        
        listContact.add(new Contact("Marry John", "marry.john@gmail.com", "1:01"));
        listContact.add(new Contact("Tom Smith", "tomsmith@outlook.com", "2:45"));
        listContact.add(new Contact("John Purcell", "john123@yahoo.com", "6:09"));
        listContact.add(new Contact("Siva Krishna", "sivakrishna@gmail.com", "0:48"));
         
        return listContact;
    }
}
