"use client";

interface Props {
  avatarUrl?: string | null;
  characterAvatar: string;
  imgClassName?: string;
  emojiClassName?: string;
}

export default function AvatarDisplay({ avatarUrl, characterAvatar, imgClassName = "", emojiClassName = "" }: Props) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`rounded-full object-cover shrink-0 ${imgClassName}`} />;
  }
  return <span className={`shrink-0 ${emojiClassName}`}>{characterAvatar}</span>;
}
