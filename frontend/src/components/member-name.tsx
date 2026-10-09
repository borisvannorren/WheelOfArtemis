import type { TeamMember } from '@/lib/api'
import { memberColor } from '@/lib/member-color'

type MemberNameProps = {
  member: TeamMember
  className?: string
}

/** A member's name with a dot in their wheel colour, so the same person is recognisable everywhere on the page. */
export function MemberName({ member, className = '' }: MemberNameProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: memberColor(member.id) }}
      />
      {member.name}
    </span>
  )
}
