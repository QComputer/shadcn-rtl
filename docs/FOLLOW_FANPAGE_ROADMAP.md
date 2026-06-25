# Follow & Fanpage Feature - Phased Roadmap

## Current Status

### ✅ Already Implemented
| Component | Location | Status |
|-----------|----------|--------|
| Follow Model | prisma/schema.prisma:940-951 | Exists |
| Follow Service | lib/services/follow.service.ts | Implemented |
| Follow API | api/organizations/[id]/follow/route.ts | POST/DELETE endpoints exist |
| Follower Count UI | app/[locale]/page.tsx (homepage) | Displaying counts |

## Phase 1: Enhanced Follow Model & Content Models
**Goal:** Add media content capabilities to Follow functionality

### Database Schema Additions
```prisma
model FollowPost {
  id          String   @id @default(cuid())
  organizationId String
  authorId    String
  content     String?  @db.Text
  imageId     String?
  videoId     String?
  isStory     Boolean  @default(false)
  isPinned    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  
  organization Organization @relation(fields: [organizationId], references: [id])
  author       User       @relation(fields: [authorId], references: [id])
  image        Image?     @relation(fields: [imageId], references: [id])
  video        Image?     @relation(fields: [videoId], references: [id])  // Videos stored as Images
  
  @@index([organizationId])
  @@index([authorId])
  @@index([isStory])
  @@index([createdAt])
}

model FollowPostLike {
  id       String @id @default(cuid())
  postId   String
  userId   String
  createdAt DateTime @default(now())
  
  post FollowPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([postId, userId])
  @@index([postId])
  @@index([userId])
}

model FollowPostComment {
  id       String @id @default(cuid())
  postId   String
  userId   String
  content  String @db.Text
  createdAt DateTime @default(now())
  deletedAt DateTime?
  
  post FollowPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([postId])
  @@index([userId])
}
```

### Tasks
1. Create migration file for new models
2. Update Organization model to include `followPosts` relation
3. Update User model to include `postLikes`, `postComments` relations

## Phase 2: Content Management API
**Goal:** RESTful endpoints for posts, stories, comments, and likes

### Endpoints to Create
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations/[slug]/posts` | GET | List posts/stories for followers |
| `/api/organizations/[slug]/posts` | POST | Create new post (admin only) |
| `/api/posts/[id]` | PATCH | Edit post (author/admin) |
| `/api/posts/[id]` | DELETE | Delete post (author/admin) |
| `/api/posts/[id]/like` | POST | Like/unlike post |
| `/api/posts/[id]/comments` | GET | Get comments |
| `/api/posts/[id]/comments` | POST | Add comment |

### Tasks
1. Create `lib/services/follow-post.service.ts`
2. Create `app/api/organizations/[slug]/posts/route.ts`
3. Create `app/api/posts/[id]/route.ts`
4. Create `app/api/posts/[id]/like/route.ts`
5. Create `app/api/posts/[id]/comments/route.ts`

## Phase 3: UI Integration
**Goal:** Follow button in shop and fanpage interface

### Components to Create/Modify
1. `app/[locale]/shop/[slug]/layout.tsx` - Add follow button to header
2. `app/[locale]/appointment/[slug]/fanpage/page.tsx` - New follower feed page
3. `components/follow/follow-button.tsx` - Reusable follow/unfollow button
4. `components/follow/post-feed.tsx` - Facebook-like feed component
5. `components/follow/post-card.tsx` - Individual post display
6. `components/follow/create-post-dialog.tsx` - Admin post creation

### Tasks
1. Add `MapPin` icon import to shop layout
2. Implement follow button with real-time state
3. Create fanpage page layout
4. Add navigation entry for fanpage

## Phase 4: Media & Interactivity
**Goal:** Rich media posts with stories, full interactivity

### Features
- Story carousel (24-hour expiry)
- Photo/video upload for posts
- Like counts and animations
- Nested comments
- Reply to comments

### Components
- `components/follow/story-carousel.tsx`
- `components/follow/media-upload.tsx`
- `components/follow/comment-section.tsx`

## Phase 5: Notifications & Real-time
**Goal:** Notification system and WebSockets

### Tasks
1. Add notification triggers in follow-post service
2. Create notification UI bell icon
3. Implement WebSocket connection for real-time updates
4. Add push notification support

## File Structure Required

```
app/
  [locale]/
    organizations/
      [slug]/
        fanpage/
          page.tsx           # Follower feed page
    shop/
      [slug]/
        layout.tsx           # Add follow button
lib/
  services/
    follow-post.service.ts   # New service
  validators/
    follow-post-schemas.ts   # New validators
components/
  follow/
    follow-button.tsx
    post-feed.tsx
    post-card.tsx
    story-carousel.tsx
    create-post-dialog.tsx
    comment-section.tsx
    media-upload.tsx
```

## Migration Commands
```bash
npx prisma migrate dev --name follow-content-models
npx prisma generate
```

## Testing Strategy
- Unit tests for services
- API integration tests (existing e2e patterns)
- Component tests for UI interactions