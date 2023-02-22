import { runAppleScript } from "./runAppleScript"

const getAllContactsProgram = `
// Get the Contacts application
let contactsApp = Application("Contacts");

// Get the list of contacts
let contacts = contactsApp.people();

// Log the names and email addresses of each contact
contacts.slice(0,9).forEach(function(contact) {
  console.log(contact.name());
  let emails = contact.emails();
  emails.forEach(function(email) {
    console.log(" - " + email.value());
  });
});`

console.log("Running...");
const allContacts = await runAppleScript({
  script: getAllContactsProgram,
  jxa: true
})
console.log("Done!");
console.log(allContacts);