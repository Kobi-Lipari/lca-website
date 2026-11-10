# WS16: K's list for Amazon SES, the newsletter and the switch-on

Written on Tuesday, November 10, 2026, beside `ws16-plan-notes.md`, revised the same evening after three reviews, and checked that night against Amazon's and Cloudflare's own pages, read on Tuesday, November 10, 2026, and K's decisions 1 to 30. Everything here is K's to do, in order. Names and values that Amazon or Cloudflare makes (DKIM tokens, the account number, a topic's ARN, the keys) are read from their pages as each step says, and none of them is written here. **A secret is typed or pasted straight into the console field that holds it: never into chat, a file or the repository.** Every read of production below is a read-only query K runs alone, with K's own credentials, in the Cloudflare dashboard (Storage & Databases, D1, `lca-db`, Console) or from the repository folder with `npx wrangler d1 execute lca-db --remote --command "..."`; nothing here writes to production by hand.

## What K can do now, before any code exists

None of this changes the live site: no code reads these settings until checkpoint M merges, and the Amazon keys carry mail only after the cutover's own change.

In this order: section 1; then sections 2 and 3; while Amazon checks the DNS records (usually within an hour), sections 4 and 5; section 9 as soon as the identity shows **Verified**; then sections 6, 7, 8 and 10. The addresses of the newsletter and of LCA's other lists wait for the address map: section 11, once K has decided it.

### 1. The AWS account

1. Open Amazon's **Sign up for AWS (advanced)** at https://signin.aws.amazon.com/signup?request_type=register. Do not use the "Start free with AWS" button on aws.amazon.com, and do not sign up with a Google, GitHub, Apple or Amazon login: that is Amazon's new sign-up, which puts a United States account in US East (Ohio), gives it no Region menu and no root user, and cannot be undone. Enter K's own address as the root user email address (decision 3) and an account name, enter the code Amazon emails, and set the root user's password. Then Amazon's remaining steps, in its order:
   - **Account plan: Paid.** The USD $100 sign-up credit comes with either plan, but the Free plan ends after six months or when its credits run out, and then Amazon closes the account by itself; once Resend is gone, every receipt, confirmation and newsletter would stop. Amazon SES at LCA's volume costs cents a month, and the budget in step 3 watches it.
   - Contact details, the card and the phone check.
   - **Support plan: Basic** (included, no charge; every other plan costs money).
   Activation usually takes minutes and at most 24 hours. Check before going on: the console's top bar has a Region menu at the right. If it shows "Manage projects" and no Region menu, stop and tell the lead before creating anything. If the Free plan was chosen by mistake, upgrade before switch-on day: sign in, open Upgrade plan (https://console.aws.amazon.com/billing/home?#/freetier/upgrade) and choose **Upgrade account**.
2. Turn on a second sign-in factor for the root user: the account menu at the top right, then Security credentials, then Assign MFA device.
3. Set a cost alert: Billing and Cost Management, then Budgets, then Create budget, a monthly cost budget of a few dollars with an email alert to K. Amazon's pricing page (read on Tuesday, November 10, 2026): new accounts start on the Essentials plan, $0.16 for each 1,000 emails with no monthly fee; à la carte is $0.10 for each 1,000. Either is under a dollar a month at LCA's volume. To move to à la carte: Amazon SES, Pricing plan, **Cancel plan** (for an account Amazon put on Essentials by default, the first cancellation takes effect at once).
4. In the console's region menu at the top right choose **US East (N. Virginia), us-east-1**, and do every SES, SNS and CloudWatch step below in it (question 9). Note the 12-digit Account ID from the account menu at the top right: the two policies below need it where they say ACCOUNT-ID.

### 2. The domain, with Easy DKIM

Amazon SES, then Configuration, then Identities, then **Create identity**:

- Identity type: **Domain**. Domain: `louisianachess.org`.
- **Use a custom MAIL FROM domain**: leave it off for now. The return path's name is one of the address forms K decides together (decision 28; the address map), and Amazon lets it be set later on the identity's page (section 11). Until then Amazon uses its own return path: SPF passes for an `amazonses.com` domain, and DMARC passes on the DKIM signature.
- Verifying your domain: **Easy DKIM**, key length **RSA_2048_BIT**, **Publish DNS records to Route53** off (the DNS is at Cloudflare), DKIM signatures **Enabled**.
- If the page offers a default configuration set, leave it for now: section 4 sets it to `lca-mail` once that set exists.
- Create identity.

### 3. The DNS records at Cloudflare

Where to read each value: Amazon SES, Identities, `louisianachess.org`, the **Authentication** tab. Its "DomainKeys Identified Mail (DKIM)" box lists three CNAME records in a "Publish DNS records" table, each with a copy icon. Where to add them: the Cloudflare dashboard, `louisianachess.org`, DNS, Records, **Add record**.

| Kind | Name (Cloudflare adds `.louisianachess.org`) | Value | Read it from | At Cloudflare |
|---|---|---|---|---|
| CNAME | the first token, then `._domainkey` | copy the DKIM table's Value with its copy icon; do not type `.dkim.amazonses.com` from this list (Amazon: its last part varies by Region and identity) | the DKIM table, row 1 | Proxy status: **DNS only** (grey cloud) |
| CNAME | the second token, then `._domainkey` | copy the DKIM table's Value with its copy icon; do not type `.dkim.amazonses.com` from this list (Amazon: its last part varies by Region and identity) | the DKIM table, row 2 | DNS only |
| CNAME | the third token, then `._domainkey` | copy the DKIM table's Value with its copy icon; do not type `.dkim.amazonses.com` from this list (Amazon: its last part varies by Region and identity) | the DKIM table, row 3 | DNS only |

After Save, Cloudflare's record list must show each name with `louisianachess.org` at most once. If it appears twice, edit the name to the part before `.louisianachess.org`. (Amazon warns that some DNS hosts add the domain to a pasted name; Cloudflare's page does not say how its Name field treats one, so check.)

Leave alone: the root MX (LCA's mailboxes), the root SPF record, the `_dmarc` record (it stays `p=none`; if Amazon's page suggests a DMARC record, do not add a second one), and Resend's `send.` records and `resend._domainkey` (they stay until a week after Resend is removed). Do read the `_dmarc` record once: if it holds `adkim=s` or `aspf=s` (strict alignment), tell the lead before deciding the address map, since under strict alignment mail from a subdomain passes DMARC only with that subdomain's own signing key. The identity's page shows **Verified** and DKIM **Successful**, usually within an hour and at most 72 hours.

### 4. The configuration set, the topic and the event destination

1. Amazon SES, Configuration, Configuration sets, **Create set**: name `lca-mail`; leave the rest as offered, except Reputation options: leave **Reputation metrics** unticked (it costs extra, and the alarms in part B use the account-level metrics); the suppression list follows the account's settings. Create. Then Identities, `louisianachess.org`, the **Configuration set** tab, **Default configuration set**, Edit, choose `lca-mail`, Save changes, so a send that ever lacks the set still publishes its bounces and complaints to the topic.
2. Amazon SNS (the same region), Topics, **Create topic**: type **Standard** (SES cannot publish to a FIFO topic), name `lca-mail-events`. Create. On the topic's page copy nothing yet; its **ARN** is read in section 8.
3. If the topic's Edit page offers a message signature version, choose **2** (SHA256). If it does not, leave it; the site accepts both.
4. The topic's **Access policy**: Edit, then replace the policy with this one, with ACCOUNT-ID filled in twice in the ARNs and once in the condition:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSesToPublishForTheLcaMailSet",
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "SNS:Publish",
      "Resource": "arn:aws:sns:us-east-1:ACCOUNT-ID:lca-mail-events",
      "Condition": {
        "StringEquals": {
          "AWS:SourceAccount": "ACCOUNT-ID",
          "AWS:SourceArn": "arn:aws:ses:us-east-1:ACCOUNT-ID:configuration-set/lca-mail"
        }
      }
    }
  ]
}
```

5. Amazon SES, Configuration sets, `lca-mail`, the Event destinations tab, **Add destination**. Select event types: tick **Hard bounces** and **Complaints** only; Next. Specify destination: Destination type **Amazon SNS**; Name `lca-mail-to-site`; Event publishing: tick **Enabled**; SNS topic `lca-mail-events`; Next; **Add destination**. The site's subscription to the topic waits for switch-on day, when the site can answer it.
6. Amazon SNS, Topics, `lca-mail-events`, Edit, expand **Delivery retry policy (HTTP/S)**: 50 retries, none without delay, a minimum and a maximum delay of 60 seconds, the other retry counts 0; Save changes. SNS then keeps trying for about 50 minutes (Amazon allows at most an hour) through a short outage of the site, instead of giving up after a minute. Set on the topic, it applies to every HTTP/S subscription, and the site's is the only one.

### 5. Amazon's own suppression list: bounces only

Amazon SES, Configuration, **Suppression list**, the Account-level settings, Edit: Suppression list **Enabled**; in **Suppression reasons** choose the bounces-only option (Bounces only); Save changes. Why: with complaints on it, one spam report on a newsletter would make Amazon silently drop that family's receipts and confirmations too; the site handles spam reports itself, per list. Amazon allows this setting while the account is in the sandbox.

### 6. A sandbox recipient and a first console test

Wait until the identity shows **Verified** and DKIM **Successful** (section 3).

1. Amazon SES, Identities, Create identity, **Email address**: K's own address; open the email Amazon sends and press its link. In the sandbox only verified addresses and Amazon's mailbox simulator can receive.
2. Amazon SES, Identities, `louisianachess.org`, **Send test email**: format Formatted; From-address `noreply`; Scenario **Custom** with K's verified address; any subject and body; configuration set `lca-mail`. Send.
3. In K's mailbox, open the message's full headers (in Gmail: the three dots, then Show original) and tell the lead: DKIM **PASS** with `d=louisianachess.org`, and DMARC **PASS** (through DKIM). SPF passes for an `amazonses.com` domain until the return path is set in section 11; that is expected. This checks the DNS early; the site's own request, its stored key and the receiver are checked on switch-on day (part B below).

### 7. The sending key, with the least it needs

1. IAM, Users, **Create user**: name `lca-site-mail`; no console access; attach no policy; Create user.
2. On the user's page: Permissions, Add permissions, **Create inline policy**, JSON. Paste this policy with ACCOUNT-ID filled in, name it `lca-site-send-only`, and create it:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendSiteMailOnly",
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": [
        "arn:aws:ses:us-east-1:ACCOUNT-ID:identity/louisianachess.org",
        "arn:aws:ses:us-east-1:ACCOUNT-ID:configuration-set/lca-mail"
      ],
      "Condition": {
        "StringLike": {
          "ses:FromAddress": [
            "noreply@louisianachess.org"
          ]
        }
      }
    }
  ]
}
```

   One action, sending; one identity; one configuration set; and, for now, one sender, `noreply@louisianachess.org`, which sends event and account mail. The addresses K decides for LCA's lists join it in section 11, before switch-on day. The key cannot read quotas, lists, settings or other mail. If a send is refused for the identity (Amazon's refusal names the resource it wanted), tell the lead: the fix is to add the one ARN Amazon names, never `"Resource": "*"`.
3. Security credentials, **Create access key**; choose **Application running outside AWS** (or **Other**, as Amazon's guide says), tick the confirmation if asked, Next, **Create access key**. On Retrieve access keys, press **Show**; do not download the .csv. The page shows the **access key ID** and the **secret access key** once: keep the page open and go straight to section 8.

### 8. The secrets in Cloudflare

Make the link key on K's own PC with `openssl rand -base64 32` and copy what it prints straight into the two fields below (keep a copy only in a password manager, if at all). If `openssl` is not found, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` instead: it prints the same kind of 44-character value, and it works in PowerShell, cmd and bash. The key must never change while sent emails' links should work; if it ever must, the old value goes into `MAIL_LINK_SECRET_PREVIOUS` for at least 30 days. Type or paste it the same way into both places: each list email stores a check of the key it was made with, and a deployment whose copy differs sends nothing and says so in the history.

| Secret (the binding's name) | Its value | Pages project `lca-website`, Production | Worker `lca-daily-emails` | Preview |
|---|---|---|---|---|
| `SES_ACCESS_KEY_ID` | the access key ID from section 7 | yes | yes | never |
| `SES_SECRET_ACCESS_KEY` | the secret access key from section 7 | yes | yes | never |
| `MAIL_LINK_SECRET` | the value openssl printed | yes | yes, the same value | never |
| `SES_SNS_TOPIC_ARN` | the topic's ARN, from Amazon SNS, Topics, `lca-mail-events` | yes | no | never |
| `RESEND_API_KEY` | today's | stays until a week after step 12 | stays until then | never |

- **Pages:** Cloudflare dashboard, Workers & Pages, `lca-website`, Settings, **Variables and Secrets** (on older dashboards, Environment variables), the **Production** environment, Add, name and value, choose **Secret** (Cloudflare's page calls the choice Encrypt), Save. A Pages secret is read by the next deployment, so set each one before the merge that needs it; setting all of them today is safe.
- **Worker:** Workers & Pages, `lca-daily-emails`, Settings, Variables and Secrets, Add, type **Secret**, name and value, for each of the three, then press **Deploy** (without it the worker gets no keys); or, from the repository folder on K's PC, `npx wrangler secret put SES_ACCESS_KEY_ID --config workers/daily-emails/wrangler.toml` and paste at its hidden prompt, then the same for `SES_SECRET_ACCESS_KEY` and `MAIL_LINK_SECRET`; the wrangler command deploys by itself.
- **Preview:** check that the Preview environment holds none of these names; it holds no secret today, and must not, so a preview can never send mail.

### 9. The request for real sending

File this as soon as the identity shows **Verified** (usually within an hour of section 3), once sections 4 and 5 are done, since the text below describes them: Amazon's answer, within 96 hours, is the slowest part of the path. Amazon says a verified domain helps a request be approved faster. Amazon SES, **Get set up** (or the Account dashboard), **Request production access**:

- The form has five parts: **Mail type** (**Transactional**: most of what the site sends is registration, payment and account mail; the text below says plainly that a monthly newsletter goes to members too), **Website URL** (`https://www.louisianachess.org`), **Additional contacts** (up to four addresses; an LCA address K chooses), **Preferred contact language** (English) and **Acknowledgement**.
- There is no box for a description or a quota, so keep the text below and send it as the reply when AWS Support writes.
- In Amazon's words, the acknowledgement says you "agree to only send email to individuals who've explicitly requested it and confirm that you have a process in place for handling bounce and complaint notifications". The process is Amazon's suppression list now and the site's receiver from switch-on day (the text says so). Tick it only if K is satisfied that this is true of members under decision 10, which the marked gap below asks K to put in K's own words.
- Write the marked gap before pressing **Submit request**: it is what lets K tick the acknowledgement honestly, and the form's details cannot be changed until the review ends.

> The Louisiana Chess Association (LCA) is a volunteer, nonprofit chess association. Our website, www.louisianachess.org, lets people join LCA, register for chess tournaments and reach our volunteers. It sends two kinds of email from our own domain, louisianachess.org.
>
> 1. Event and account email, from noreply@louisianachess.org: registration confirmations, payment receipts, tournament reminders a person asked for, replies to support requests, and notices to the volunteers who run events. Each goes to one person because of something they did on the site.
> 2. A newsletter for our members, from an address on our own domain, louisianachess.org, about once a month; and later, email from individual chess clubs, also from addresses on louisianachess.org, to people who choose to get it. The newsletter goes to the addresses on the accounts of our current, paid members.
>
> **[K, in K's own words: how LCA membership has said it includes the newsletter (where, and since when); that addresses that are not members' are never added without their own request; and whether LCA has ever bought, rented or shared a list.]**
>
> About 155 current members use the site's accounts. We expect fewer than 100 emails on most days and up to a few hundred on a day a newsletter goes out. Each message goes to one recipient.
>
> Every newsletter and club email carries one-click unsubscribe headers (RFC 8058), a visible unsubscribe link and a link to a preferences page where a person can turn each list off or stop all optional email; an unsubscribe takes effect at once. Event and account email has no unsubscribe, since each message answers something the person did.
>
> Bounces and complaints: our configuration set publishes bounce and complaint events to an Amazon SNS topic. Our website checks each notification's signature and topic before acting; this goes live and is tested with the mailbox simulator before our first send through Amazon SES. A permanent bounce puts the address on our do-not-send list, which stops all mail to it; a complaint unsubscribes the person at once from the list it was made on, and from the optional email of other senders such as individual clubs. Our account-level suppression list is on for bounces.

Amazon's first answer comes within 96 hours and may ask for more; answer with the same facts.

### 10. Workers Paid

Move the Cloudflare account to **Workers Paid** ($5 a month, as the lead found) in the dashboard's Workers plans, and tell the lead (the lead's token cannot read billing). The cutover to Amazon SES waits for it (question 3, which K settled): on the free plan a request gets 10 ms of processor time, and signing each message for Amazon could cut a director's announcement part way and then send it twice when the director presses Send again. The site keeps the free plan's batch sizes until `WORKERS_PLAN` becomes `'paid'`: in the switch-on change if this section is done by then, otherwise in the cutover change. Resend keeps carrying event and account mail on its free tier until the cutover, as today; no paid month of Resend is needed, since the newsletter goes out only through Amazon SES (question 2).

## Once K decides the address map, before switch-on day

### 11. The addresses K decided

K decides every address and domain form together, once, from the lead's address map, `ws16-address-map.md` (decision 28): each From address and its display name, where replies go, each sending subdomain and the return-path subdomain. Decide by about Saturday, November 14, 2026, so Amazon's checks (up to 72 hours) finish before switch-on day. Then, in `us-east-1`:

1. **The return path.** At Cloudflare, check that no record has the name K chose (the map recommends `bounce`); if one does, tell the lead. Then Amazon SES, Identities, `louisianachess.org`, the **Authentication** tab, the **Custom MAIL FROM domain** pane, Edit: tick **Use a custom MAIL FROM domain**, enter the name K chose, Behavior on MX failure **Use default MAIL FROM domain**, Save changes. Add the two records the pane's "Publish DNS records" table lists, each copied with its copy icon: an **MX** on that name, `feedback-smtp.us-east-1.amazonses.com` with priority 10, the only MX on that name; and a **TXT** on that name, `v=spf1 include:amazonses.com ~all`. The pane shows MAIL FROM **Success** within 72 hours.
2. **A sending domain of LCA's lists' own**, only if K chose one (the map's choice 3): Identities, **Create identity**, Domain, the name K chose, with the settings of section 2 and its custom MAIL FROM domain on, named as the map gives; its three DKIM CNAME records as in section 3; its MAIL FROM's MX and TXT as in step 1; its **Configuration set** tab's Default configuration set `lca-mail`, as in section 4 step 1. Any other record the map lists for that domain, as the map gives it.
3. **The key's senders.** IAM, Users, `lca-site-mail`, Permissions, `lca-site-send-only`, Edit: add each From address K decided for LCA's lists under `ses:FromAddress` and, if step 2 made a sending domain of its own, its identity ARN under `Resource` (`arn:aws:ses:us-east-1:ACCOUNT-ID:identity/` followed by that domain); Save changes. Part B's test sends from the newsletter's address, so this comes before switch-on day.
4. Tell the lead the forms K decided: the switch-on change writes them into the site's one address setting.

## What K decides before the switch can go on

**Decided by K on Tuesday, November 10, 2026** (decision 28, "all recommended"): (1) the newsletter goes to accounts with an active membership, as a rule, not widened unless K says so; K's two counts are a check on switch-on day, not a condition; (2) the newsletter goes only through Amazon SES, with no paid month of Resend; (3) the cutover waits for Workers Paid; (4) the media manager is a board seat, Media manager; (6) Groups of members stays hidden until it has its own unsubscribe.

**Still to decide**, each in `ws16-plan-notes.md` with the recommended answer first and its reason, then the other options: (4, its second half) whether the media manager also uses Specific people (recommended: no); (5) the address map, every address and domain form together, by about Saturday, November 14, 2026 (section 11); (7) step 11's list: its name, needed before checkpoint M merges since migration 0060 writes it, its reach and the media manager's masked review list; (8) decision 18's reading as the lead gave it; (9) `us-east-1` and the suppression list for bounces only; (10) the launch scripts' send halves removed with Resend; (11) the switch-on, then the cutover, then the first newsletter; (12) the newsletter page's open points, in part two. Silence keeps each recommendation, except the address map, which K decides. Also: who the media manager is, and that they can sign in with a second factor.

## Before checkpoint M merges

1. K's answer on the name of step 11's list (question 7), since migration 0060 writes it.
2. `npm run db:migrate:preview` from the branch (K, or the lead's session) before looking at the preview (ordering rule 2).
3. Look at the preview with `mailLists` and `MAIL_LISTS_ON` on together, as far as signing in on a preview allows.
4. Confirm again that the Preview environment holds none of section 8's names.
5. The lead shows the two throwaway runs green: the switch-on change's gate (with `WORKERS_PLAN` `'paid'`, the path K is advised to take), and the cutover change's gate on top of it.
6. K's go on the pull request.

## Switch-on day, after checkpoint M merges, in this order

### A. The switch-on

1. In the repository's Actions tab, the two runs for the merge are green: "Apply database migrations" and "Deploy scheduled-jobs worker". If the first is not there, run `SELECT id, main_mailer FROM mail_lists;` (two rows, each with 1). If either run failed, stop and tell the lead.
2. Section 8's secrets are in the Pages project's Production environment and in the worker (their names show; their values never do).
3. Cloudflare dashboard, `louisianachess.org`, Security, Settings; filter by **Bot traffic**; **Bot fight mode**. If it is on, tell the lead before part B. It may challenge Amazon's calls to the site and a mail program's one-click unsubscribe, and WAF custom rules and Page Rules cannot skip it; the lead brings K the options with a recommendation.
4. The two read-only counts under question 1 (in `ws16-plan-notes.md`); tell the lead the figures. They are a check, not a condition. If the second finds migration 0002's sample members, an LCA admin decides whether to remove those accounts through the admin screens; the list skips them either way.
5. Add the seat the way seats are added today, titled exactly **Media manager** (its link name becomes `media-manager`), and assign the person on the seat screen. The seat shows on the public Board page with its holder, like every seat (question 4). The person sets up two-factor sign-in at `/account/security` if they have not.
6. Merge the switch-on change the lead prepares: `mailLists` and `MAIL_LISTS_ON` on; `WORKERS_PLAN` `'paid'` only if section 10 is done; the senders as K decided them in the address map (section 11). `MAIL_SENDER` stays `'resend'`. Then check that its "Deploy scheduled-jobs worker" run is green.
7. K's first test: Admin, Group email, **The LCA newsletter list**, a short message with the subject `Test ½ from LCA`, and the test box to K's own address (through Resend for now, from `noreply@louisianachess.org`). In the email: the footer's reason line and its two links. Press **Email preferences**: turn the newsletter off, save, turn it back on, save. Press **Unsubscribe from the LCA newsletter**: the page, the button, "Done"; then turn it back on from the preferences page.

### B. Amazon SES's checks, which work in the sandbox (before the cutover)

8. Amazon SNS, Topics, `lca-mail-events`, **Create subscription**: protocol **HTTPS**, endpoint `https://www.louisianachess.org/api/mail/ses-events`, **Enable raw message delivery** off. Within a minute it shows **Confirmed**. If it stays "Pending confirmation", stop and tell the lead: the cutover waits. The topic's retry policy (section 4 step 6) covers this subscription.
9. Amazon SES, Identities, `louisianachess.org` (and the lists' own sending domain, if section 11 made one), Notifications, Edit: **Email feedback forwarding** Disabled, Save. While forwarding is on, Amazon emails each bounce and complaint report to the sending address, and `noreply@` has no mailbox; Amazon's service terms (section 15.4) let it suspend sending when the address it sends reports to is not receiving email. Disabling it is allowed now that the configuration set publishes the events to the topic.
10. The site's own test through Amazon SES, sent by an LCA admin (K, or an admin K asks): Group email, the newsletter tab, the test box with **Send the test through Amazon SES** ticked, the same subject. It goes from the newsletter's address as K decided it, with its display name and reply-to, so it waits for section 11 (the key refuses an address its policy does not list), and the cutover waits for it:
    - to K's own verified address: it arrives; in its full headers, the From line as K decided it; SPF **PASS** for the return-path name of section 11; on the DKIM-Signature whose `d=` is the signing domain (`louisianachess.org`, or the lists' own domain if section 11 made one), **PASS**, and whether `list-unsubscribe` is among the names after `h=` (tell the lead); DMARC **PASS**; the half sign arrived as a half sign. This proves the stored key, its policy for the newsletter's address, that address's DNS and the site's own request, which section 6's console test does not;
    - to `bounce@simulator.amazonses.com`, and then to `complaint@simulator.amazonses.com`.
    Then run `SELECT address, reason, detail, created_at FROM mail_do_not_send ORDER BY created_at DESC LIMIT 5;` (the bounce address is there, reason `bounce`) and `SELECT c.address, ch.list_id, ch.choice, ch.source, c.complained_at FROM mail_contacts c JOIN mail_list_choices ch ON ch.contact_id = c.id WHERE c.address = 'complaint@simulator.amazonses.com';` (one row: `lca-newsletter`, `out`, `complaint`, and a time in `complained_at`). Both rows there means the receiver works; the cutover waits for both. Both addresses are Amazon's simulator's, harmless on the lists.
11. Three alarms that email K, set after step 10's sends (Amazon says the SES metrics may not show until the Region has sent an email). First Amazon SNS, Topics, Create topic, Standard, `lca-alarms`, and a subscription to it by **Email** to K's own address (confirm it from the email Amazon sends). Then:
    - The bounce rate: Amazon SES, **Reputation metrics**, the **Account-level** tab, the **Bounce rate** pane, **View in CloudWatch**, the bell icon on the metric's line. Conditions: **Static**, **Greater/Equal**, `0.02`. Additional configuration, Missing data treatment: **Treat missing data as ignore (maintain the alarm state)**. Next. **In Alarm**, **Select an existing SNS topic**, `lca-alarms`. Next, a name, Next, **Create alarm**. Amazon reviews an account at a 5% bounce rate and may pause it at 10%.
    - The complaint rate: the same from the **Complaint rate** pane, with `0.0005`. Amazon reviews an account at 0.1% and may pause it at 0.5%; on a newsletter of about 155, one spam report is about 0.65%.
    - Failed deliveries to the site: CloudWatch, Alarms, **Create alarm**, Select metric, SNS, Topic Metrics, `lca-mail-events`, **NumberOfNotificationsFailed**; Statistic **Sum**, Period **5 minutes**; **Greater/Equal** `1`; missing data: ignore; **In Alarm**, `lca-alarms`. It fires when at least one delivery try failed; SNS keeps trying for about 50 minutes, so tell the lead rather than assume a notice was lost. If NumberOfNotificationsFailed is not listed for `lca-mail-events` (CloudWatch lists a metric only once it has data), skip this alarm for now and tell the lead.
12. After part B: Cloudflare dashboard, `louisianachess.org`, Security, Analytics, the **Events** tab; **Add filter** on Path for `/api/mail/ses-events` (filters take no wildcards): no challenge there. Cloudflare labels what Bot Fight Mode challenged as Bot Fight Mode in the Service field; none should be on a path under `/api/mail/`.

### C. The cutover, once Amazon has approved real sending

13. Amazon has approved real sending: AWS Support's reply says so, and Amazon SES no longer shows the warning "Your Amazon SES account is in the sandbox".
14. In Resend's dashboard, its suppression list: copy each address Resend lists as **bounced** into Amazon SES, Suppression list, **Add email address**, reason Bounce, so those addresses come back to the site as already suppressed without counting against the bounce rate, and the receiver records them. Leave out the ones Resend lists for a spam report: on Amazon's list they would stop that family's receipts too.
15. Section 10 is done (Workers Paid).
16. Merge the cutover change the lead prepares: `MAIL_SENDER` `'ses'` (with `WORKERS_PLAN` `'paid'` if part A did not set it). Then check that its "Deploy scheduled-jobs worker" run is green.
17. K's second test, now through the live path: the same test to K's own address, the same header checks; and in Gmail, if it shows its own **Unsubscribe** beside the sender's name, press it, then open the preferences page from the email and see the newsletter off; turn it back on. Then an LCA admin sends K a short note from Group email's **Specific people**: it arrives from `noreply@louisianachess.org`, the first send through the key's entry for event and account mail. If it does not arrive within a few minutes, tell the lead at once, who sets `MAIL_SENDER` back to `'resend'`.

### D. The first newsletter

18. Sent by an LCA admin, the president or the media manager: name the newsletter in the subject, member news first, links pasted by hand, a tournament's King Registration link included; a renewal reminder is a separate email. The tab's recent sends show it sending: the first batch within the minute and the rest by the next five-minute run, which the worker sends with its own copies of the keys. A row that reads "Not sent yet: ..." means a key on the worker differs from the site's: tell the lead. If something is wrong in the first minutes, press **Stop sending**: addresses not yet reached do not get it.

### E. Over the next days

19. The three alarms, and Amazon SES's reputation page (Amazon SES, Reputation metrics) for the bounce and complaint rates. Gmail passes Amazon no spam reports, so Google's rate is not on that page; if K wants it, Google Postmaster Tools needs one TXT record at the root (it leaves the mailboxes alone) and may show nothing at LCA's volume. Google asks senders to keep spam reports below 0.10% and never to reach 0.30%.
20. Once in a while, Amazon SNS, Topics, `lca-mail-events`: the site's subscription is still there and Confirmed. A notification carries an address that can remove the subscription; only the site receives notifications, over HTTPS, and it keeps none of them, but if the subscription is ever gone, the alarm above cannot see it.

If Amazon has not approved by switch-on day, parts A and B still go ahead, Resend keeps carrying event and account mail, and parts C to E follow once Amazon has approved and section 10 is done.

## About 30 days after the cutover: Resend removed

1. Tell the lead SES has carried the mail cleanly (no notice from Amazon, low bounce and complaint rates); the lead builds step 12 and K merges checkpoint O.
2. **A week after that merge, not before** (the rollback needs them until then): delete Resend's API key in Resend's dashboard; remove `RESEND_API_KEY` from the Pages project and the worker (`npx wrangler secret delete RESEND_API_KEY --config workers/daily-emails/wrangler.toml`); then delete Resend's DNS records at Cloudflare: the `send` MX and TXT records and the `resend._domainkey` TXT record, and any other record Resend's Domains page lists for `louisianachess.org` (read the names there).
3. Keep or close the free Resend account, as K likes.

## Never

- Paste a key into chat, a file or the repository.
- Put any mail secret on the Preview environment.
- Change the root MX, the root SPF record or the DMARC record for this work.
- Add a second MX record to the return-path name of section 11, or proxy the DKIM records through Cloudflare.
- Send the newsletter through Resend.
- Add an address Resend lists for a spam report to Amazon's suppression list.
- Write to production by hand: every read above is a SELECT.
