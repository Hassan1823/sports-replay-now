"use client";

import { intuitivePoints, neverMissPoints } from "@/lib/data";
import Image from "next/image";

export function HeroSecond() {
  return (
    <div className="w-full min-h-[80vh] h-auto flex lg:flex-row flex-col justify-center items-start gap-[4vh]">
      {/* left container */}
      <div className="lg:w-1/2 w-full h-full flex flex-col justify-center items-center gap-y-[3vh]">
        {/* banner */}
        <div className="w-full relative min-h-[50vh] h-full flex flex-col justify-start items-center bg-cover bg-center">
          <Image
            fill
            alt="hero image"
            src={"/unsplash-image-jkhis90HL4k.jpg"}
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        </div>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[2rem] font-extrabold leading-[2rem] text-center">
          NEVER MISS A MEMORY
          <span className="">AGAIN!</span>
        </h1>

        {/* points */}
        <ol className="w-full h-auto list-disc space-y-2 px-[8vw] lg:px-[3vw]">
          {neverMissPoints?.map((data: string, idx: number) => (
            <li
              key={idx}
              className="text-[1.3rem] font-semibold w-full h-auto text-wrap"
            >
              {data}
            </li>
          ))}
        </ol>
      </div>

      {/* right container */}
      <div className="lg:w-1/2 w-full h-full flex flex-col justify-center items-center gap-y-[3vh]">
        {/* banner */}
        <div className="w-full relative min-h-[60vh] h-full flex flex-col justify-start items-center bg-cover bg-center">
          <Image
            fill
            alt="hero image"
            src={"/VideoPages.png"}
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        </div>

        <h1 className="w-auto h-auto capitalize flex flex-col justify-center items-center text-[2rem] font-extrabold leading-[2rem] text-center ">
          Intuitive and Easy to
          <span className="">Use!</span>
        </h1>

        {/* points */}
        <ol className="w-full h-auto list-disc space-y-2 px-[8vw] lg:px-[3vw]">
          {intuitivePoints?.map((data: string, idx: number) => (
            <li
              key={idx}
              className="text-[1.3rem] font-semibold w-full h-auto text-wrap"
            >
              {data}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
