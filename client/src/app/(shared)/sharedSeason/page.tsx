"use client";

import SeasonComponent from "@/components/(shared)/sharedSeason/SeasonComponent";
import Navbar from "@/components/Home/Navbar";
import React from "react";

const SeasonPage = () => {
  return (
    <>
      <Navbar />

      <div>
        <SeasonComponent />
      </div>
    </>
  );
};

export default SeasonPage;
