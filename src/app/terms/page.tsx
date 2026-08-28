import type { Metadata } from 'next';
import Link from 'next/link';
import { brand, legalConfig } from '@/config';
import { Clause, LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: `The agreement between you and ${brand.name}.`,
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="The agreement between you and us. Short, because a long one is a way of hiding things."
    >
      <Clause heading="What this is">
        <p>
          {brand.name} makes invitations, collects replies, and runs a shared wall people post to
          during an event. Using it means agreeing to this and to the{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            privacy policy
          </Link>
          .
        </p>
      </Clause>

      <Clause heading="Your account">
        <p>
          You need one to host. Keep control of the email address it uses, because whoever can read
          that inbox can sign in as you. Guests do not need an account to reply.
        </p>
      </Clause>

      <Clause heading="What you post stays yours">
        <p>
          Your photographs, video, recordings and words remain yours. You give us permission to
          store them and show them to the people you invited, for as long as the event runs. That
          permission exists to run the product and ends when the content is deleted.
        </p>
      </Clause>

      <Clause heading="If you are hosting">
        <p>
          <strong>You are responsible for the contact details you add.</strong> By adding someone
          you are confirming you know them and that passing on their address or number for this
          invitation is something they would reasonably expect. Do not paste in a purchased list,
          and do not use {brand.name} to reach strangers.
        </p>
        <p>
          This matters more than it sounds. Unwanted messages get sending domains blocked, and a
          blocked domain means nobody&rsquo;s invitations arrive — including the invitations of
          hosts who did nothing wrong.
        </p>
        <p>
          You are also responsible for what your guests post on your wall. You can remove any post
          and mute anybody.
        </p>
      </Clause>

      <Clause heading="What not to do">
        <p>
          Nothing illegal, nothing that harasses or impersonates, nothing that infringes someone
          else&rsquo;s work, and nothing sexual involving minors. Do not try to reach data belonging
          to events you were not invited to, and do not automate against the service in ways that
          degrade it for other people. We can suspend an account or end an event that does these
          things.
        </p>
      </Clause>

      <Clause heading="Everything expires">
        <p>
          This is the point of {brand.name}, not a limitation to work around: an event and
          everything in it is deleted after the window the host chose.{' '}
          <strong>It is not a backup service and it is not an album.</strong> Download the archive
          before the event expires if you want to keep the photographs — hosts can do that at any
          time, and once the sweep has run the files are genuinely gone.
        </p>
      </Clause>

      <Clause heading="Paid plans">
        <p>
          Billing is not switched on. Every event currently runs on the top plan and nobody is
          charged. When that changes you will be told before it does, not after, and nothing you
          have already made will stop working because of it.
        </p>
      </Clause>

      <Clause heading="No promises about uptime">
        <p>
          We work hard to keep it running and we do not guarantee it. {brand.name} is provided as it
          is, without warranties. If something goes wrong our liability is limited to what you paid
          us in the previous twelve months — which, while billing is off, is nothing. Some places do
          not allow that limit, in which case it does not apply to you.
        </p>
      </Clause>

      <Clause heading="Ending it">
        <p>
          Delete your events and stop using it whenever you like. We may suspend an account that
          breaks these terms, and we will say why unless doing so would make an ongoing abuse
          problem worse.
        </p>
      </Clause>

      <Clause heading="Changes, and which law applies">
        <p>
          If these terms change materially, the date at the top changes and we say so before it
          takes effect.
        </p>
        {legalConfig.governingLaw ? (
          <p>These terms are governed by the laws of {legalConfig.governingLaw}.</p>
        ) : (
          <p>
            A governing jurisdiction has not been set for these terms yet. Naming one we had not
            actually chosen would be worse than saying so.
          </p>
        )}
      </Clause>
    </LegalPage>
  );
}
