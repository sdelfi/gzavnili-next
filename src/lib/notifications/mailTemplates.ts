// Ported verbatim from `bema/messages/templates.cfm`'s `mtemplates` struct — see
// docs/decisions/0027-cron-notifications.md. Keys are this schema's `MessageType.key`
// (legacy's numeric `idmessagetype` noted per template for cross-reference). Tokens
// (`{trackingnum}`, `{firstname}`, `{service}`, `{servicetransit}`, `{paidmessage}`,
// `{unpaidmessage}`, ...) are substituted by `substituteTokens()` in `notificationEngine.ts`.
//
// Not reproduced here: `{attachment}` (t7/parcel_damaged embeds actual uploaded photos in
// legacy — there's no equivalent attachment mechanism ported yet), `{receiverid}` (computed
// by `sendMessages.cfm` but appears in no template's actual content, so substituting it has
// no observable effect), and the empty `<a href="">order number</a>` in `parcel_added`'s
// English body, which is a dead link in legacy itself — kept exactly as broken.
export const MAIL_TEMPLATES: Record<string, { en: string; ge: string }> = {
  // t1 — Just add parcel
  parcel_added: {
    en: `
<div class="mail-h">Thanks for your trust to as - now you are in good hands!</div>
<p>Just to be sure please double check if trucking number {trackingnum} just added to our system is correct.</p>
<p><strong>You can do it by:</strong></p>
<ul>
	<li>Check your email from merchant</li>
	<li>Go to your account on merchant page</li>
	<li>Check your receipt from UPS, FedEx or USPS</li>
</ul>
<p>After correct declaration of your parcel, there is nothing to do before your parcel {trackingnum} will be delivered to us.</p>
<div class="note">
	Note: please do not use <a href="">order number</a> instead of trucking number we will be unable to truck and care  about your package.
</div>
<p>If you wish to be informed about next step of parcel managing, make sure to activate desired notification type on <a href="/account/settings">ACCOUNT SETTING</a> page</p>`,
    ge: `
<div class="mail-h">მადლობა ნდობისთვის - თქვენ ახლა საიმედო ხელში ხართ!</div>
<p>გთხოვთ, გადაამოწმეთ საძიებო ნომერი (Trucking Number) {trackingnum}, რომელიც ახლახანს დაამატეთ სისტემაში სწორია. შემოწმება შეგიძლიათ: </p>
<ul>
	<li>იხილეთ მაღაზიისგან მიღებული ელექტრონული წერილი</li>
	<li>გადაამოწმეთ მაღაზიის ვებ გვერდის თქვენ ანგარიშზე.</li>
	<li>შეამოწმეთ UPS, FedEx ან USPS-ის ქვითარი</li>
</ul>
<p>სწორად დეკლარირებული ამანათის შემდეგ, უნდა დაველოდოთ ყუთის {trackingnum},  ჩვენს ამერიკის ოფისში მოტანას, მანამდე ვერაფერს შევძლებთ.</p>
<div class="note">
		შენიშვნა: გთხოვთ არ შეიყვანოთ სისტემაში შეკვეთის (Order) ნომერი (Trucking Number)-ის ნაცვლად, რადგან ვერ შევძლებთ ასეთ ამანათზე თვალყურის დევნებას.
</div>
<p>თუ გაქვთ სურვილი, რომ მიიღოთ შეტყობინებები თქვენი ამანათის გადაადგილების შემდეგი ეტაპების შესახებ, გთხოვთ ეწვიოთ <a href="/account/settings">პარამეტრების</a> გვერდს და გააქტიუროთ სასურველი შეტყობინების სახე.</p>`,
  },

  // t2 — Payment Reminder
  payment_reminder: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Remember, your parcel is in good hands!</div>
<p>This is a friendly reminder, of missing payment for parcel(s) with trucking number {trackingnum}</p>
<p>Please watch our video tutorial how to pay for our service. At time of making payment, if you wish you can request delivery and we will bring it to your address, if not you can pick up your parcel form our office.</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>ამ წერილით, ბოდიშის მოხდით გატყობინებთ, რომ გადაუხდელი გაქვთ დავალიანება შემდეგი ამანათ(ებ)ის გამო{trackingnum}</p>
<p>გთხოვთ, ნახოთ ჩვენი ვიდეო გაკვეთილი თუ როგორ გადაიხადოთ მომსახურების ღირებულება. მომსახურების ღირებულების გადახდისას, სურვილის შემთხვევაში შეგიძლიათ კურიერის მომსახურების გადახდაც და ამანათს მისამართზე მოგართმევთ.</p>`,
  },

  // t3 — Missing information (also legacy's "missed" operation — see docs/findings.md)
  missing_information: {
    en: `
<div class="mail-h">Hello {firstname}<br>
	Your parcel is in good hands, but we need little help from your side.</div>
<p>We detect that one of your parcel {trackingnum} is missing following info:</p>
{missinginfo}
<div class="note">
	Please watch our video tutorial how to Correct parcel information info to system.
</div>
<p>After correct declaration of your parcel, there is nothing to do before your parcel {trackingnum} will be delivered to us.</p>
<p>If you wish to be informed about next step of parcel managing, make sure to activate desired notification type on <a href="/account/settings">ACCOUNT SETTING</a> page</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>თქვენი ამანათი საიმედო ხელშია, მაგრამ გვჭირდება თქვენგან მცირედი დახმარება:</div>
<p>ჩვენ აღმოვაჩინეთ, რომ ამანათის {trackingnum} სრული დეკლარირებისთვის აკლია შემდეგი ველ(ებ)ი: </p>
{missinginfo}
<div class="note">
		გთხოვთ ნახოთ ჩვენი ვიდეო გაკვეთილი, როგორ გავასწოროთ ამანათის მონაცემები.
</div>
<p>სწორად დეკლარირებული ამანათის შემდეგ, უნდა დაველოდოთ ყუთის {trackingnum},  ჩვენს ამერიკის ოფისში მოტანას, მანამდე ვერაფერს შევძლებთ.</p>
<p>თუ გაქვთ სურვილი, რომ მიიღოთ შეტყობინებები თქვენი ამანათის გადაადგილების შემდეგი ეტაპების შესახებ, გთხოვთ ეწვიოთ <a href="/account/settings">პარამეტრების</a> გვერდს და გააქტიუროთ სასურველი შეტყობინების სახე.</p>`,
  },

  // t4 — Out for Delivery
  out_for_delivery: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Remember, your parcel is in good hands!</div>
<p>Today on {today} by end of day we will deliver your parcel(s) with trucking number(s) {trackingnum}</p>
<p>Those parcels were shipped  with {service} and transit took {servicetransit} days.</p>
<p>Thanks for you trust to Gzavnili.com. See you soon!</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>ამ წერილით, ბოდიშის მოხდით გატყობინებთ, რომ გადაუხდელი გაქვთ დავალიანება შემდეგი ამანათ(ებ)ის გამო{trackingnum}</p>
<p>ეს ამანათ(ებ)ი გამოგზავნილი იქნა {service} -ით და გადაზიდვის ვადამ შეადგინა {servicetransit} დღე.</p>
<p> მადლობთ, რომ ენდობით კომპანია გზავნილს. შეხვედრამდე!</p>`,
  },

  // t5 — We just got your parcel(s)
  parcel_received: {
    en: `
<div class="mail-h">Hello   {firstname}<br>
	Remember, your parcel is in good hands!</div>
<p>Today on {today} we receive your parcel(s) with trucking number {trackingnum}</p>
<p>Those parcels will be sent on {senddate} with {service} and estimated delivery time is {deliverydate}.</p>
<div class="note">Please watch our video tutorial how to pay parcel for our service.
	After making payment, there is nothing to do before your parcel picking up or delivering to your door step.
</div>
<p>If you wish to be informed about next step of parcel managing, make sure to activate desired notification type on <a href="/account/settings">ACCOUNT SETTING</a> page</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს {today} მივიღეთ თქვენი ამანათ(ებ)ი შემდეგი ნომრით {trackingnum}</p>
<p>აღნიშნული ამანათ(ებ)ი გაგიგზავნება {senddate}  {service} სერვისით და სავარაუდო ჩატანის ვადაა {deliverydate}.</p>
<div class="note">
	გთხოვთ, ნახოთ ჩვენი ვიდეო გაკვეთილი თუ როგორ გადაიხადოთ მომსახურების ღირებულება. ღირებულების გადახდის შემდეგ, უნდა დაელოდოთ ამანათის საქართველოში ჩატანას, მანამდე არაფერია გასაკეთებელი.
</div>
<p>თუ გაქვთ სურვილი, რომ მიიღოთ შეტყობინებები თქვენი ამანათის გადაადგილების შემდეგი ეტაპების შესახებ, გთხოვთ ეწვიოთ <a href="/account/settings">პარამეტრების</a> გვერდს და გააქტიუროთ სასურველი შეტყობინების სახე.</p>`,
  },

  // t6 — Shipped to region
  parcel_shipped_region: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Remember, your parcel is in good hands!</div>
<p>Today on {today} we shipped your parcel(s) {rcity} with trucking number {trackingnum}</p>
<p>Please allow us 1-2 business days deliver your parcels to  {rcity}</p>
<p>Thanks for you trust to Gzavnili.com. See you soon!</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს  {today} ჩვენ გამოვგზავნეთ {rcity} თქვენი ამანათ(ებ)ი შემდეგი ნომრით {trackingnum}</p>
<p>გთხოვთ მოგვცეთ 1-2 სამუშაო დღე {rcity}-ში ჩამოსატანად</p>
<p> მადლობთ, რომ ენდობით კომპანია გზავნილს. შეხვედრამდე!</p>`,
  },

  // t7 — Damaged Parcel. `{attachment}` (photo images) not reproduced — see module doc comment.
  parcel_damaged: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Your parcel is in good hands, but accidents happens some times ... </div>
<p>We detect that one of your parcel content is damaged. Please see images:</p>
{attachment}
<div class="note">
   Please contact merchant immediately to replace or refund damaged goods.
</div>
<p>Ready letter forms you can find in our site's footer.</p>
<p>We are hold this parcel until your instruction.</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>მაგრამ აქციდენტი ზოგჯერ ხდება. ამანათის დათვალიერებისას აღმოვაჩინეთ, რომ ამანათის შიგთავსი დაზიანებულია. გთხოვთ, სურათი იხილოთ ბმულზე:</p>
{attachment}
<div class="note">
		გთხოვთ, დაუკავშირდით მაღაზიას დაუყოვნებლივ, რათა აგინაზღაუროს ზარალი ან დაგიბრუნონ თანხა.
</div>
<p>წერილის მზა ფორმა ჩვენი გვერდის ქვედა ნაწილშია განთავსებული</p>
<p>ჩვენ ვაჩერებთ ამ ამანათს, თქვენს შემდეგ ინსტრუქციამდე.</p>`,
  },

  // t8 — Parcel Delivered
  parcel_delivered: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Remember, your parcel is in good hands!</div>
<p>Today on {today} we already deliver your parcel(s) with trucking number(s) {trackingnum}</p>
<p>Parcels were delivered to  {rname}</p>
<p>Thanks for you trust to Gzavnili.com. See you soon!</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს  {today} უკვე ჩავაბარეთ მიმღებს შემდეგი ამანათ(ებ) {trackingnum}</p>
<p>ამანათი მიიღო {rname} მ და ეს არის ხელმოწერა</p>
<p> მადლობთ, რომ ენდობით კომპანია გზავნილს. შეხვედრამდე!</p>`,
  },

  // t9 — Parcel(s) Departed
  parcel_departed: {
    en: `
<div class="mail-h">Hello {firstname}<br>Remember, your parcel is in good hands!</div>
<p>Today on {today} we shipped your parcel(s) with trucking number {trackingnum}</p>
<p>Those parcels were shipped  with {service} and estimated delivery time is {deliverydate}.</p>
{paidmessage}
{unpaidmessage}
<div class="note">
	Please watch our video tutorial how to pay parcel for our service.
	After making payment, there is nothing to do before your parcel picking up or delivering to your door step.
</div>
<p>If you wish to be informed about next step of parcel managing, make sure to activate desired notification type on <a href="/account/settings">ACCOUNT SETTING</a> page</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს {today} ჩვენ გამოვგზავნეთ თქვენი ამანათ(ებ)ი შემდეგი ნომრით {trackingnum}</p>
<p>ეს ამანათ(ებ)ი, გამოიგზავნა    {service} სერვისით და სავარაუდო ჩატანის ვადაა {deliverydate}.</p>
{paidmessage}
{unpaidmessage}
<p>ღირებულების გადახდის შემდეგ, არაფერია გასაკეთებელი ამანათის გატანამდე ან მოითხოვეთ კურიერის მომსახურება, რომ მისამართზე მოგართვათ.</p>
<p>თუ გაქვთ სურვილი, რომ მიიღოთ შეტყობინებები თქვენი ამანათის გადაადგილების შემდეგი ეტაპების შესახებ, გთხოვთ ეწვიოთ <a href="/account/settings">პარამეტრების</a> გვერდს და გააქტიუროთ სასურველი შეტყობინების სახე.</p>`,
  },

  // t12 — Parcel stopped by customs (see the mapping note in seed-message-types.ts)
  parcel_customs_hold: {
    en: `
<div class="mail-h">Hello   {firstname}<br>Remember, your parcel is in good hands!</div>
<p>Today on {today} on Georgian customs were hold for inspection following parcel(s){trackingnum}</p>
<div class="note">
	If reason of holding parcel on custom is missing information, please watch our video tutorial how to Correct parcel information info to system.
</div>
<p>If there is some other reason, we will notify parcel receiver about further actions.</p>
<p>We are sorry about inconvenience.</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს {today} საქართველოს საბაჟომ შესამოწმებლად გააჩერა შემდეგი ამანათ(ებ)ი {trackingnum}</p>
<p>თუ ამანანათის გაჩერების მიზეზი არის არასრული დეკლარირება, გთხოვთ ნახოთ ჩვენი ვიდეო გაკვეთილი, როგორ გავასწოროთ ამანათის მონაცემები.</p>
<p>თუ ამანათის გაჩერების მიზეზი სხვაა, ჩვენ შევატყობინებთ ამანათის მიმღებს შემდეგი ქმედების შესახებ.</p>
<p>ჩვენ ძალიან ვწუხვართ შექმნილი უხერხულობის გამო.</p>`,
  },

  // t14 — Ready to pickup (office)
  ready_to_pickup: {
    en: `
<div class="mail-h">Hello   {firstname}<br>
Remember, your parcel is in good hands!</div>
<p>Today on {today} we receive your parcel(s) in Tbilisi office with trucking number(s) {trackingnum}</p>
<p>Those parcels were shipped  with {service} and estimated delivery time is {deliverydate}.</p>
{paidmessage}
{unpaidmessage}`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს {today} ჩვენ თბილისის ოფისში მივიღეთ შემდეგი ამანათ(ებ)ი {trackingnum}</p>
<p>ეს ამანათ(ებ)ი, გამოიგზავნა   {service} სერვისით და სავარაუდო ჩატანის ვადაა {deliverydate}.</p>
{paidmessage}
{unpaidmessage}`,
  },

  // t16 — Parcel was picked up
  parcel_picked_up: {
    en: `
<div class="mail-h">Hello   {firstname}<br>
Remember, your parcel is in good hands!</div>
<p>Today on {today} your parcel(s) with trucking number {trackingnum} were picked up by  {rname}</p>
<p>Thanks for you trust to Gzavnili.com. See you soon!</p>`,
    ge: `
<div class="mail-h">მოგესალმებით {firstname}<br>გახსოვდეთ, თქვენი ამანათი საიმედო ხელშია!</div>
<p>დღეს  {today} უკვე გატანილია შემდეგი ამანათ(ებ) {trackingnum} ამანათ(ებ)ი გაიტანა {rname}</p>
<p> მადლობთ, რომ ენდობით კომპანია გზავნილს. შეხვედრამდე!</p>`,
  },
};
