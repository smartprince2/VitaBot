import fetch from "node-fetch"
import { Readable } from "stream"

export async function uploadImage(data:Buffer|Readable):Promise<string>{
    const res = await fetch(process.env.IMAGE_UPLOAD_URL, {
        headers: {
            Authorization: process.env.IMAGE_UPLOAD_AUTH,
            "Content-Type": "image/png"
        },
        method: "post",
        body: data
    })
    const text = await res.text()
    return `${process.env.IMAGE_UPLOAD_URL}${JSON.parse(text).filename}`
}