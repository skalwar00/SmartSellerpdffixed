'use client'

export function DashboardHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-6 py-5">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {description && (
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      )}
    </div>
  )
}
