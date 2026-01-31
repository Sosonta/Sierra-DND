export type BlogTag = "News" | "Guide" | "Advertisement" | "Recruitment" | "Event";

export const BLOG_TAGS: BlogTag[] = ["News", "Guide", "Advertisement", "Recruitment", "Event"];

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  tags: BlogTag[];
  contentText: string;
  createdAt?: any;
  updatedAt?: any;
  authorUid: string;
  authorAliasSnapshot: string;
  authorPronounsSnapshot: string | null;
  authorPhotoSnapshot: string | null;
};

export type BlogComment = {
  id: string;
  authorUid: string;
  authorAliasSnapshot: string;
  authorPronounsSnapshot: string | null;
  authorPhotoSnapshot: string | null;
  text: string;
  createdAt?: any;
  parentId: string | null;
};
