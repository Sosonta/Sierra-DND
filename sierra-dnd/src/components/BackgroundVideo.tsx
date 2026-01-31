import React from "react";
import loopMp4 from "../assets/loop.mp4";

export function BackgroundVideo() {
  return (
    <div className="bg-video" aria-hidden="true">
<video
  className="bg-video__media"
  autoPlay
  muted
  loop
  playsInline
  preload="auto"
  controls={false}
  disablePictureInPicture
  controlsList="nodownload noplaybackrate noremoteplayback"
  tabIndex={-1}
  aria-hidden="true"
>
  <source src={loopMp4} type="video/mp4" />
</video>


      {/* Optional: overlay to improve contrast/readability */}
      <div className="bg-video__overlay" />
    </div>
  );
}
