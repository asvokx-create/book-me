type ProfileAvatarProps = {
  name: string;
  imageUrl?: string | null;
  className?: string;
};

export default function ProfileAvatar({ name, imageUrl, className = "h-10 w-10 text-sm" }: ProfileAvatarProps) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";

  return (
    <span
      role="img"
      aria-label={`${name || "BubsBookings"} profile photo`}
      style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#e6eedf] bg-cover bg-center font-bold ${className}`}
    >
      {!imageUrl && initials}
    </span>
  );
}

