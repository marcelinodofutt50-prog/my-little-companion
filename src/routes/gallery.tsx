import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/gallery')({
  component: () => (
    <div className="p-8 grid grid-cols-2 gap-8 bg-white">
      <div><p>shadow-mark-v8.png</p><img src="/assets/shadow-mark-v8.png" className="border w-full" /></div>
      <div><p>shadow-hero-classic.png</p><img src="/assets/shadow-hero-classic.png" className="border w-full" /></div>
      <div><p>enterprise-management-v2.png</p><img src="/assets/enterprise-management-v2.png" className="border w-full" /></div>
      <div><p>shadow-logo.jpg</p><img src="/assets/shadow-logo.jpg" className="border w-full" /></div>
      <div><p>shadow-mask.png</p><img src="/assets/shadow-mask.png" className="border w-full" /></div>
      <div><p>shadow-swoosh.png</p><img src="/assets/shadow-swoosh.png" className="border w-full" /></div>
    </div>
  )
})
