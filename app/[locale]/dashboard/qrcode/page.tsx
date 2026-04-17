'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"

export default function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
const [url, setUrl] = useState("")
const [imageUrl, setImageUrl] = useState("")

useEffect(()=>{

})

const handleSubmit = async () => {
    const response = await fetch('/api/qrcode', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
          }),
      })
        const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization")
      }
       setImageUrl(data.url)
}
return (
    <div key={"qrcode-page"}>
<div className="flex gap-5 p-5">
    <Input
        placeholder={"insert the url"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pr-10"
        />
        <Button
          onClick={handleSubmit}
        >
            submit
        </Button>
        </div>
<div className="my-10 px-20">
        {imageUrl && 
        <img
        src={imageUrl}
              alt="Image Preview"
              className=" items-center mr-2 h-full w-full object-cover rounded-md"
              
        />}
        </div>
    
</div>)
}