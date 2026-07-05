#!/usr/bin/env node
import webpush from "web-push"

const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || ""
const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
const subject = process.env.WEB_PUSH_VAPID_SUBJECT || ""

console.log("VAPID key validation")
console.log("====================")
console.log(`publicKey length: ${publicKey.length}`)
console.log(`privateKey length: ${privateKey.length}`)
console.log(`subject: ${subject || "(empty)"}`)

try {
  webpush.setVapidDetails(subject || "mailto:test@example.com", publicKey, privateKey)
  console.log("\nOK: web-push accepts this VAPID key pair")
} catch (err) {
  console.error("\nFAIL: Invalid VAPID key pair")
  console.error(err)
  process.exit(1)
}
