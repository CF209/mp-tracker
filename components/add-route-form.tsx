"use client";

import { useState, useTransition } from "react";
import { addRoute } from "@/app/actions";

export default function AddRouteForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await addRoute(data);
      if (res.ok) {
        form.reset();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <input
        name="url"
        placeholder="https://www.mountainproject.com/route/.../some-route"
        required
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add route"}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
