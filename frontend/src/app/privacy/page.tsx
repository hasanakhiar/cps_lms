import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What CPS Learning stores, why, and for how long.",
};

/**
 * The privacy policy.
 *
 * Written to describe what this application actually does rather than pasted from a
 * template: one first-party session cookie, no analytics, no third-party scripts, no
 * advertising identifiers. Every claim here corresponds to something in the code — if
 * a tracker is ever added, this page has to change with it.
 */
export default function PrivacyPage() {
  return (
    <div className="container flex max-w-3xl flex-col gap-8 py-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="text-muted-foreground">
          What we store, why we store it, and how to get rid of it.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">What we collect</h2>
        <p className="text-muted-foreground text-pretty">
          When you create an account we store your username, email address and a hashed
          password. As you use the platform we record which courses you are enrolled in,
          which lessons you have completed, and the answers and scores of quizzes you submit.
        </p>
        <p className="text-muted-foreground text-pretty">
          That is the entire list. We do not collect your location, your device
          fingerprint, or your activity on other sites.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Cookies</h2>
        <p className="text-muted-foreground text-pretty">
          We set one cookie: an encrypted session cookie that keeps you signed in. It is
          marked <code className="rounded bg-muted px-1 py-0.5 text-sm">HttpOnly</code>, so
          JavaScript running in your browser cannot read it, and it expires after seven days.
        </p>
        <p className="text-muted-foreground text-pretty">
          There are no analytics cookies, no advertising cookies, and no third-party scripts
          on any page — which is why you have not been asked to accept anything.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Who can see your data</h2>
        <p className="text-muted-foreground text-pretty">
          Your progress and quiz results are yours. Other learners cannot see them — the
          server filters every request to your own records rather than relying on the
          interface to hide things.
        </p>
        <p className="text-muted-foreground text-pretty">
          Instructors can see the progress of students enrolled in courses they teach, and
          administrators can see platform-wide totals and manage accounts. Nobody, including
          administrators, can read your password.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Sharing</h2>
        <p className="text-muted-foreground text-pretty">
          We do not sell your data and we do not share it with advertisers. Data is held by
          our hosting and database providers solely to run this service.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Retention and deletion</h2>
        <p className="text-muted-foreground text-pretty">
          Your account and its learning records are kept until you ask us to delete them.
          Contact an administrator to have your account removed; deletion also removes your
          enrolments, lesson completions and quiz attempts.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Changes</h2>
        <p className="text-muted-foreground text-pretty">
          If what we store changes, this page changes with it.
        </p>
      </section>
    </div>
  );
}
