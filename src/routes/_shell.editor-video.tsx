import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/shared/page-header";
import { VideoEditor } from "@/components/video-editor/video-editor";

export const Route = createFileRoute("/_shell/editor-video")({
  head: () => ({
    meta: [
      { title: "Editor de Vídeo · Shoppfy" },
      {
        name: "description",
        content: "Corte seu vídeo e adicione legendas direto no navegador, pronto pra postar.",
      },
      { property: "og:title", content: "Editor de Vídeo · Shoppfy" },
      {
        property: "og:description",
        content: "Corte seu vídeo e adicione legendas direto no navegador, pronto pra postar.",
      },
    ],
  }),
  component: EditorVideoPage,
});

function EditorVideoPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="Editor de Vídeo"
        description="Envie o vídeo que você gravou, corte, adicione legendas e baixe pronto pra postar."
      />
      <VideoEditor />
    </div>
  );
}
