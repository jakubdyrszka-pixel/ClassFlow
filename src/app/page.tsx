import React from "react";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { isSignedIn } = await auth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <h1 className="text-4xl font-bold mb-4 text-foreground">ClassFlow Demo</h1>
      {isSignedIn ? (
        <p className="text-lg text-muted-foreground">You are logged in. Explore the dashboard via the menu.</p>
      ) : (
        <p className="text-lg text-muted-foreground">Please sign in to access the application.</p>
      )}
    </main>
  );
}
