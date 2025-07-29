import { VideoPageMain } from "@/components/video/videoPage";
import React from "react";
import Protected from "../protected";

const Video = () => {
  return (
    // <div className="h-screen max-h-auto lg:max-h-screen overflow-y-hidden ">
    <>
      <Protected>
        <div className="h-screen lg:max-h-screen max-h-auto lg:overflow-y-hidden overflow-y-visible">
          <VideoPageMain />
        </div>
      </Protected>
    </>
  );
};

export default Video;
