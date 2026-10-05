(async () => {
  const video = document.querySelector("video");
  if (!video) throw new Error("No video to review");
  const v: HTMLVideoElement = video;
  v.pause();
  v.currentTime = 0;
  v.playbackRate = 1;
  v.muted = true;
  v.controls = false;
  document.querySelectorAll("canvas").forEach((c) => {
    c.remove();
  });
  const c = document.createElement("canvas");
  c.width = 1920;
  c.height = 1080;
  document.body.append(c);
  document.body.style.margin = "0";
  Object.assign(c.style, { position: "fixed", inset: "0", zIndex: 9 });
  const context = c.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const ctx: CanvasRenderingContext2D = context;
  let i = 0;
  const times: number[] = [];
  const start = performance.now();
  const initialQuality = v.getVideoPlaybackQuality();
  ctx.fillStyle = "#10110e";
  ctx.fillRect(0, 0, c.width, c.height);
  function frame(_now: number, m: VideoFrameCallbackMetadata) {
    if (i < 16 && m.mediaTime >= (i * v.duration) / 16) {
      ctx.drawImage(v, (i % 4) * 480, Math.floor(i / 4) * 270, 480, 270);
      ctx.fillStyle = "#f5edda";
      ctx.font = "20px monospace";
      ctx.fillText(`${m.mediaTime.toFixed(3)} s`, (i % 4) * 480 + 15, Math.floor(i / 4) * 270 + 26);
      times.push(m.mediaTime);
      i++;
    }
    if (!v.ended) v.requestVideoFrameCallback(frame);
  }
  v.requestVideoFrameCallback(frame);
  v.onended = () => {
    const q = v.getVideoPlaybackQuality();
    (
      window as Window & {
        reviewStats?: unknown;
      }
    ).reviewStats = {
      duration: v.duration,
      playbackRate: v.playbackRate,
      elapsedMs: performance.now() - start,
      times,
      totalFrames: q.totalVideoFrames - initialQuality.totalVideoFrames,
      droppedFrames: q.droppedVideoFrames - initialQuality.droppedVideoFrames,
    };
  };
  await v.play();
  return "Playback started at 1x; read window.reviewStats after ending.";
})();
