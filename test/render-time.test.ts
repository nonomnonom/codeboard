import {expect,it} from "vitest";
import {StoryboardProject,createRenderSession,renderPanelPNG,renderFramePNG,renderDetail,renderCompositionGuides,renderOnionSkin} from "../src/index.js";

it("uses the same exact frame domain for panel, timeline, crop, guides and sessions",async()=>{
  const project=StoryboardProject.create({title:"Frame domain",width:32,height:32});
  const panel=project.addScene("S").addShot("A").addPanel({durationFrames:12});
  panel.addVectorLayer("Ink").vectorStroke([{x:4,y:4},{x:28,y:28}]);
  const session=createRenderSession(project);
  for(const frame of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    expect(()=>session.panel(panel.id,frame)).toThrow(/nonnegative safe integer/);
    expect(()=>session.frame(frame)).toThrow(/nonnegative safe integer/);
    for(const render of [
      ()=>renderPanelPNG(project,panel.id,{frame}),()=>renderFramePNG(project,frame),
      ()=>renderDetail(project,panel.id,{x:0,y:0,width:16,height:16},frame),
      ()=>renderCompositionGuides(project,panel.id,{frame}),
      ()=>renderOnionSkin(project,[{panelId:panel.id,frame}]),
    ])await expect(render()).rejects.toThrow(/nonnegative safe integer/);
  }
  const last=await renderFramePNG(project,11);
  expect((await session.frame(11).toBuffer("png")).equals(last)).toBe(true);
  await expect(renderFramePNG(project,12)).rejects.toThrow(/No panel is exposed/);
  // Explicit panel review can inspect a held pose outside that panel's timeline interval.
  expect((await renderPanelPNG(project,panel.id,{frame:12,annotations:false})).equals(last)).toBe(true);
});
