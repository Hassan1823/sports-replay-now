"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Hero() {
  return (
    <div className="w-full min-h-[80vh] h-auto flex lg:flex-row flex-col justify-center items-start gap-[4vh]">
      {/* left container */}
      <div className="lg:w-1/2 w-full h-full flex flex-col justify-center items-center gap-y-[3vh]">
        {/* title */}
        <h1 className="w-full h-auto capitalize text-[2.5rem] font-extrabold leading-[3rem] text-start text-wrap whitespace-break-spaces">
          {`Easily Share Sports Videos with your Athletes, Parents, and Coaches`}
        </h1>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[2rem] font-extrabold leading-[2rem] text-center ">
          $100.00 U.S.D.
          <span className="">per YEAR</span>
        </h1>

        <Button
          size={"lg"}
          className="lg:hidden block w-[70%] h-auto p-[2%] rounded-full bg-green-600 hover:bg-green-700/80"
        >
          <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
        </Button>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[1.7rem] font-bold leading-[2rem] text-center ">
          Fed up with high cost
          <span className="">Video sites?</span>
        </h1>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[1.7rem] font-bold leading-[2rem] text-center ">
          Just want to share
          <span className="">game or practice videos?</span>
        </h1>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[1.7rem] font-bold leading-[2rem] text-center ">
          Get this exclusive Deal
          <span className="">now!</span>
        </h1>

        <Button
          size={"lg"}
          className="hidden lg:block w-[15vw] h-auto p-[2%] rounded-full bg-green-600 hover:bg-green-700/80"
        >
          <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
        </Button>
      </div>

      {/* right container */}
      <div
        className="lg:w-1/2 w-full min-h-[80vh] h-full flex flex-col justify-start items-center bg-cover bg-center"
        style={{ backgroundImage: "url('/unsplash-image-tn9z0AR5JiQ.jpg')" }}
      />
    </div>
  );
}
