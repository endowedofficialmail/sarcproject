import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
          <p className="text-sm font-medium tracking-wide text-primary">SARC</p>
          <h1 className="mt-3 text-3xl font-semibold text-card-foreground sm:text-4xl">
            Benefits Management System
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            A secure and reliable platform to manage student healthcare benefits across member schools
            and medical institutes. Institute staff can verify beneficiaries quickly, while SARC
            administrators maintain centralized control and transparency.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Login
            </Link>
            <p className="text-sm text-muted-foreground">
              Authorized users only: Super Admin, School, Institute, and Student accounts.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
