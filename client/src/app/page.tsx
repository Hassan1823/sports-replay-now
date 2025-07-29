"use client";

import HomePage from "@/components/Home/Home";
import Navbar from "@/components/Home/Navbar";
import Protected from "./protected";

export default function Home() {
  return (
    <>
      <Protected>
        <Navbar />
        <HomePage />
      </Protected>
    </>
  );
}
