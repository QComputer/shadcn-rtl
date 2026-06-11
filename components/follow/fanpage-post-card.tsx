import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicImage } from "@/components/public/public-image";
import { Video } from "lucide-react";

export type FanpagePostCardData = {
  id: string;
  title: string | null;
  body: string;
  image: string | null;
  video: string | null;
  createdAt: Date | string;
  author: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    image: string | null;
  } | null;
};

function formatAuthorName(author: FanpagePostCardData["author"]) {
  if (!author) return "Bazar Baz";
  const fullName = [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
  return fullName || author.name || "Bazar Baz";
}

export function FanpagePostCard({ post, locale }: { post: FanpagePostCardData; locale: string }) {
  const authorName = formatAuthorName(post.author);
  const date = new Date(post.createdAt).toLocaleDateString(locale === "fa" ? "fa-IR" : locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="overflow-hidden">
      {post.video && (
        <div className="relative h-64 w-full overflow-hidden bg-muted">
          <video
            src={post.video}
            controls
            className="h-full w-full object-cover"
            poster={post.image || undefined}
          />
        </div>
      )}
      {!post.video && post.image && (
        <div className="h-64 w-full overflow-hidden bg-muted">
          <PublicImage src={post.image} alt={post.title || authorName} kind="organization" className="h-full w-full object-cover" />
        </div>
      )}
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={post.author?.avatar || post.author?.image || undefined} alt={authorName} />
            <AvatarFallback>{authorName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{authorName}</p>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
        {post.title && <CardTitle className="text-xl">{post.title}</CardTitle>}
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line leading-7 text-muted-foreground">{post.body}</p>
      </CardContent>
    </Card>
  );
}
