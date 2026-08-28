import type { Metadata } from 'next';
import Link from 'next/link';
import { brand, legalConfig } from '@/config';
import { Clause, LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `What ${brand.name} collects, why, and when it is deleted.`,
  // The one part of the site that should be indexed: Google's OAuth review fetches it, and
  // a policy nobody can find is not a policy.
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="What we collect, why we collect it, and when it goes away. In plain English, because a policy nobody reads protects nobody."
    >
      <Clause heading="The short version">
        <p>
          We hold what an invitation needs and nothing else: who is hosting, who is invited, who is
          coming, and what everyone posted. Almost all of it is deleted automatically when the event
          expires — that is the product, not a favour. We do not sell anything to anybody, and there
          is no advertising on {brand.name} today.
        </p>
      </Clause>

      <Clause heading="What we collect">
        <p>
          <strong>Your account.</strong> Your email address, and your name and profile picture if
          you signed in with Google. You can change the name; the email is how you sign in.
        </p>
        <p>
          <strong>The invitation.</strong> Its title, description, date, location, and design —
          whatever you typed into the form.
        </p>
        <p>
          <strong>Your guest list.</strong> The email addresses and phone numbers a host adds, and
          the names they give them. See the section below, because this is the part where the
          responsibility is shared.
        </p>
        <p>
          <strong>Replies.</strong> Whether someone is coming, how many people they are bringing,
          and any note they wrote. A note written for the host is stored apart from the rest of the
          reply and is shown only to the host — the guest list sees the answer and the headcount,
          never the note.
        </p>
        <p>
          <strong>What people post.</strong> Photos, video, voice notes and messages on the wall,
          and who posted them.
        </p>
        <p>
          <strong>Technical records.</strong> IP address and browser user-agent, kept against
          privileged actions in an audit log and used to rate-limit abuse. Not used to build a
          profile of anybody.
        </p>
      </Clause>

      <Clause heading="Knowing whether an invitation arrived">
        <p>
          Each guest gets their own invitation link. When that link is opened we record that it was
          opened, and when — and the host sees it, so they know who has seen the invitation and who
          has not.
        </p>
        <p>
          We record a view only when a real browser loads the page, because inboxes and corporate
          mail scanners open links automatically and counting those would tell the host something
          untrue. We do not track what you do afterwards, we do not use a tracking pixel in our
          email, and we do not follow you anywhere else.
        </p>
      </Clause>

      <Clause heading="Guest contact details come from hosts">
        <p>
          If you were invited, we almost certainly got your address or number from the person
          inviting you, not from you. Hosts agree that they have the relationship and the permission
          to pass those details on for this purpose.
        </p>
        <p>
          Every invitation email carries a one-click unsubscribe, and opting out is permanent for
          that event — re-adding you does not undo it. If you want to be removed entirely, write to{' '}
          <a
            href={`mailto:${brand.supportEmail}`}
            className="underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            {brand.supportEmail}
          </a>{' '}
          and we will remove you and tell you what we held.
        </p>
      </Clause>

      <Clause heading="Who else can see it">
        <p>Only the companies that make the product run:</p>
        <ul className="ml-5 list-disc space-y-2">
          {legalConfig.processors.map((processor) => (
            <li key={processor.name}>
              <strong>{processor.name}.</strong> {processor.does}
            </li>
          ))}
        </ul>
        <p>
          We do not sell personal information, and we do not share it for advertising. If that ever
          changes it will be asked for, not buried in an update to this page.
        </p>
        <p>
          Data is stored in the United States. If you are elsewhere, using {brand.name} means your
          information is transferred there.
        </p>
      </Clause>

      <Clause heading="How long we keep it">
        <p>
          <strong>Everything attached to an event is deleted when the event expires</strong>, after
          a short grace period: the posts, the photographs and video, the guest list, the replies
          and the notes. Not hidden — deleted, including the files in storage. Hosts can download an
          archive of everything before that happens.
        </p>
        <p>
          Your account survives your events, because you may want to make another invitation. Audit
          log entries about privileged actions are kept longer, because a security record that is
          deleted on request is not a security record.
        </p>
      </Clause>

      <Clause heading="What you can ask for">
        <p>
          A copy of what we hold, a correction, or deletion. Hosts can delete an event and
          everything in it themselves, from the host panel, immediately. For anything else, email us
          and we will do it.
        </p>
      </Clause>

      <Clause heading="Children">
        <p>
          {brand.name} is not for children under 13, and we do not knowingly collect their
          information. Children do appear in the photographs people post at family events; if you
          are their parent and want something removed, ask the host, or ask us.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          If this changes in a way that matters, the date at the top changes and we say so before it
          takes effect. The current version is always here.
        </p>
        <p>
          See also the{' '}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            terms of service
          </Link>
          .
        </p>
      </Clause>
    </LegalPage>
  );
}
