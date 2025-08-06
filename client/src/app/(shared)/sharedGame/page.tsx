"use client";

import GameComponent from "@/components/(shared)/sharedSeason/GameComponent";
import Navbar from "@/components/Home/Navbar";

const SeasonPage = () => {
  return (
    <>
      <Navbar />

      <div>
        <GameComponent />
      </div>
    </>
  );
};

export default SeasonPage;
