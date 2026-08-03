#!/usr/bin/env bun
// Seeds the 10 fixed "Specific Emails" template rows (bema "System Emails" screen). Legacy's
// `MSSQLEmailDAO.create()`/`delete()` are empty stubs and `retrieveEmailConfig()` only ever
// loads this hardcoded 10-EmailId allow-list — the row set is fixed, never
// admin-creatable/removable, so it's seeded once rather than exposed via a create/delete API.
// See docs/decisions/0031-system-emails.md for the reachability findings behind each row.
//
// `description`/`tags` are transcribed from the legacy call sites and `Template.cfc`'s
// `filterXxx()` methods (the actual DB columns' real production values aren't available to
// this port). `subject`/`message` are left blank: legacy stores those as pure admin-authored
// runtime data with no default content anywhere in the CFML codebase to port.
//
// Idempotent: upserts by id, so re-running never duplicates or clobbers admin edits.
import 'dotenv/config';
import { db } from '../src/lib/db';

const TEMPLATES = [
  {
    id: 'Invoice',
    description: 'Sent when an invoice is emailed to a customer from Statements ("Send Invoice").',
    tags: '{firstName} {lastName} {company} {address} {invoiceNum} {dueOrPaidText} {dueOrPaid} {invoiceDate} {items}',
  },
  {
    id: 'Help To Shop',
    description: 'Sent when a customer submits the "Help To Shop" request form.',
    tags: '{productLink} {quantity} {color} {size} {email} {comment}',
  },
  {
    id: 'Support Form',
    description: 'Sent when a customer submits the "Contact Us" form.',
    tags: '{email_address} {company_name} {first_name} {last_name} {date_time} {message}',
  },
  {
    id: 'Pick Up Service',
    description: 'Sent when a customer submits the "Pick Up Service" request form.',
    tags: '{firstName} {lastName} {email} {gzNumber} {address} {phone} {pickUpDate}',
  },
  {
    id: 'Quotation',
    description: 'Sent when a customer submits the "Quotation" request form.',
    tags: '{type} {pickupZipcode} {destination} {addt1} {origin} {deliveryZipcode} {addt2} {companyName} {phone} {email} {items}',
  },
  {
    id: 'Forgot Password',
    // See docs/findings.md: the legacy call site is commented out, superseded by a hardcoded
    // message. Kept as a row (matching legacy's own admin screen, which still lists it) but
    // functionally inert.
    description: 'Legacy password-reset email template — superseded in code by a hardcoded message, not currently sent.',
    tags: '{email_address} {username} {first_name} {last_name} {reset_link}',
  },
  {
    id: 'Forgot Username',
    description: 'Legacy forgot-username email template — superseded in code by a hardcoded message, not currently sent.',
    tags: '{email_address} {username} {first_name} {last_name} {login_link}',
  },
  {
    id: 'Register Email Confirmation',
    description: 'Sent on customer registration, asking them to confirm their email address.',
    tags: '{email_address} {username} {first_name} {last_name} {verify_link}',
  },
  {
    id: 'Account Change',
    description: 'Sent after a customer completes a password reset.',
    tags: '{email_address} {username} {first_name} {last_name} {login_link}',
  },
  {
    id: 'Registration',
    description: 'Sent after a customer confirms their email address (registration complete).',
    tags: '{email_address} {username} {first_name} {last_name} {login_link}',
  },
];

async function main() {
  for (const template of TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: template,
    });
  }
  console.log(`[seed-email-templates] Ensured ${TEMPLATES.length} template rows exist.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
