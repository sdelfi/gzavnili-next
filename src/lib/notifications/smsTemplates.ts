// Ported verbatim from `bema/messages/templates_sms.cfm`'s `stemplates` struct — see
// docs/decisions/0027-cron-notifications.md. Keys are this schema's `MessageType.key`. `{date}`
// is only substituted for `parcel_delivered`/`parcel_shipped_region` (see
// `notificationEngine.ts`); `{trackingUrl}` is substituted for all.
export const SMS_TEMPLATES: Record<string, { en: string; ge: string }> = {
  // t3 — Missing information
  missing_information: {
    en: `Gzavnili's note! Your parcel declaration isn't complete. Log in to your account: usa.gzavnili.com. And add missing information!`,
    ge: `Gzavnili.com. Tkveni amanati araa srulad deklarirebuli. Gtxovt ewviet tkvens kabinets: usa.gzavnili.com da sheasworet gamorchenili veli.`,
  },

  // t4 — Out for Delivery
  out_for_delivery: {
    en: `Gzavnili.com. Tkveni amanaT(eb)i gamotanilia dasarigeblad da dgis bolomde mogitanT daniSnulebis adgilas.`,
    ge: `Gzavnili.com. Tkveni amanaT(eb)i gamotanilia dasarigeblad da dgis bolomde mogitanT daniSnulebis adgilas.`,
  },

  // t5 — We just got your parcel(s)
  parcel_received: {
    en: `Gzavnili.com We got your package in USA.	For more info log in to your account: usa.gzavnili.com. Thanks for your trust to us!`,
    ge: `Gzavnili.com. Tkveni amanati miviget amerikashi. Meti informaciisatvis ewviet: usa.gzavnili.com. Madlobt gamoxatuli ndobistvis.`,
  },

  // t6 — Shipped to region. `{date}` = TrackingSendRegion.
  parcel_shipped_region: {
    en: `Gzavnili.com Your parcel was shipped from Tbilisi to region on {date}. Please allow 1-2 business days till delivery.	Thanks for your trust to us!`,
    ge: `Gzavnili.com. Dges {date}, tkveni amanati gaigzavna regionshi. Gtxovt daelodot 1-2 samushao dge. Madlobt gamoxatuli ndobistvis.`,
  },

  // t8 — Parcel Delivered. `{date}` = TrackingDeliveredSigned.
  parcel_delivered: {
    en: `Gzavnili.com Your parcel was delivered to recipient on {date}. Thanks for your trust to us!`,
    ge: `Gzavnili.com. Dges {date}, tkveni amanati chabarda mimgebs Madlobt gamoxatuli ndobistvis. `,
  },

  // t9 — Parcel(s) Departed
  parcel_departed: {
    en: `Gzavnili.com Your parcel shipped to Georgia. For more info log in to your account: usa.gzavnili.com. Thanks for your trust to us!`,
    ge: `Gzavnili.com. Tkveni amanati gamoigzavna saqartveloshi. Meti informaciistvis ewviet: usa.gzavnili.com. Madlobt ndobistvis.`,
  },

  // t12 — Parcel stopped by customs
  parcel_customs_hold: {
    en: `Gzavnili.com Unfortunately, your parcel is on hold by Georgian customs. You will be notified with further instructions. We are very sorry for inconvenience!`,
    ge: `Gzavnili.com. Samtsuxarod tkveni amanati gacherebulia sabajoze. Aucileblad shegexmianebit shemdgomi instuqciit. Vtsuxvart warmoqmnili uxerxulobis gamo. `,
  },

  // t14 — Ready to pickup (office)
  ready_to_pickup: {
    en: `usa.gzavnili.com Your parcel is ready for pick up from our Tbilisi office. Please have a trucking number and ID with you. Thanks for your trust to us! usa.gzavnili.com +995322470022 `,
    ge: `usa.gzavnili.com Tkveni amanati miviget tbilisis ofisshi. Amnatis gatanistvis dagwirdebat nomeri, pasporti an ID. Madlobt gamoxatuli ndobistvis. usa.gzavnili.com +995322470022 `,
  },
};
