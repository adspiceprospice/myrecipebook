# 📸 Image Generation Workflow

## Current Implementation

This app uses **Google's Gemini 2.5 Flash Image model** (`gemini-2.5-flash-image`) for AI-powered recipe image generation.

## How Images Work

### 1️⃣ During Recipe Creation

**Text Input** (Plain recipe text)
```
- ❌ No image generated automatically
- ✅ Can generate after creation using "Generate AI Image" button
```

**Image Upload** (Photo analysis)
```
- Uploads photo to analyze dish
- ❌ Original photo not saved (only recipe data)
- ✅ Can generate AI image after creation
```

**URL Input** (Recipe website)
```
- ✅ Automatically generates AI image
- Stores in Vercel Blob storage
```

**YouTube URL**
```
- ✅ First choice: Grabs video thumbnail
- ✅ Fallback: Generates AI image if thumbnail fails
- Stores in Vercel Blob storage
```

### 2️⃣ On-Demand Generation

Any recipe can generate new images using the **"✨ Generate AI Image"** button on the recipe detail page.

**Process:**
1. User clicks "Generate AI Image" button
2. API calls Gemini with recipe title + description
3. AI generates image based on recipe content
4. Image uploaded to Vercel Blob storage
5. Image URL added to recipe's `imageUrls` array
6. Recipe automatically refreshes with new image

## API Endpoints

### Generate Image for Recipe
```
POST /api/recipes/[id]/generate-image
```

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://...blob.vercel-storage.com/recipe-123-456.png",
  "recipe": { /* updated recipe with new image */ }
}
```

## Code Flow

### 1. Image Generation (lib/gemini.ts)
```typescript
export async function generateImageForRecipe(
  title: string,
  description: string
): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',  // Google's native image model
    contents: {
      parts: [{
        text: `Generate a delicious-looking photo of "${title}".
               It is described as: "${description}"`
      }]
    },
    config: {
      responseModalities: [Modality.IMAGE]
    }
  });

  // Returns base64 PNG image
  return `data:image/png;base64,${imageData}`;
}
```

### 2. Upload to Vercel Blob (lib/blob.ts)
```typescript
export async function uploadBase64Image(
  base64Data: string,
  filename: string
): Promise<string> {
  // Extracts base64 from data URL
  const base64String = base64Data.split('base64,')[1];

  // Converts to buffer and uploads
  const buffer = Buffer.from(base64String, 'base64');
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: 'image/png'
  });

  return blob.url; // Returns permanent CDN URL
}
```

### 3. API Route (app/api/recipes/[id]/generate-image/route.ts)
```typescript
export async function POST(request, { params }) {
  // 1. Get recipe from database
  const recipe = await prisma.recipe.findUnique({
    where: { id: params.id }
  });

  // 2. Generate image with Gemini
  const base64Image = await generateImageForRecipe(
    recipe.title,
    recipe.description
  );

  // 3. Upload to Vercel Blob
  const imageUrl = await uploadBase64Image(
    base64Image,
    `recipe-${id}-${Date.now()}.png`
  );

  // 4. Update recipe in database
  const updatedRecipe = await prisma.recipe.update({
    where: { id },
    data: {
      imageUrls: [...recipe.imageUrls, imageUrl]
    }
  });

  return { success: true, imageUrl, recipe: updatedRecipe };
}
```

### 4. Frontend Component (components/RecipeDetail.tsx)
```typescript
const handleGenerateImage = async () => {
  const response = await fetch(
    `/api/recipes/${recipe.id}/generate-image`,
    { method: 'POST' }
  );

  const data = await response.json();

  // Update local state with new image
  onRecipeUpdate({
    ...recipe,
    imageUrls: data.recipe.imageUrls
  });
};
```

## Example Prompts

The AI receives prompts like:
```
"Generate a delicious-looking photo of 'Chocolate Chip Cookies'.
 It is described as: 'Classic homemade cookies with gooey chocolate chips'"
```

This produces realistic food photography optimized for the recipe.

## Storage Architecture

```
┌─────────────────────┐
│  Gemini Flash Image │  Generates base64 PNG
│  gemini-2.5-flash   │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │  Base64 PNG  │
    │  data:image  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │  Vercel Blob CDN │  Permanent storage
    │  public access   │
    └──────┬───────────┘
           │
           ▼
    ┌───────────────────┐
    │  PostgreSQL DB    │  Stores URL reference
    │  recipe.imageUrls │
    └───────────────────┘
```

## Future Enhancements

### Potential Improvements:
1. **Model Selection** - Allow choosing between models:
   - `gemini-2.5-flash-image` (current, fast)
   - `gemini-2.5-pro-image` (higher quality, slower)
   - `imagen-3` (if available via API)

2. **Prompt Customization** - Let users specify:
   - Photo style (rustic, modern, minimalist)
   - Angle (overhead, side view, close-up)
   - Setting (restaurant, home kitchen, outdoors)

3. **Batch Generation** - Generate multiple variations at once

4. **Image Editing** - Regenerate with modifications:
   - "Make it more colorful"
   - "Add garnish"
   - "Different plating"

### Example Enhanced API:
```typescript
POST /api/recipes/[id]/generate-image
{
  "style": "professional food photography",
  "angle": "overhead",
  "setting": "marble countertop",
  "model": "gemini-2.5-pro-image"
}
```

## Testing Locally

1. Set up Vercel Blob:
   ```bash
   # Create blob store in Vercel dashboard
   # Add BLOB_READ_WRITE_TOKEN to .env
   ```

2. Test image generation:
   ```bash
   # Create a recipe, then click "Generate AI Image"
   # Check browser network tab for API call
   # Verify image appears in recipe
   ```

3. Check blob storage:
   ```bash
   # Images stored at: https://....blob.vercel-storage.com/
   # View in Vercel dashboard > Storage > Blob
   ```

## Performance Notes

- **Generation time**: 3-8 seconds per image
- **Image size**: ~200-500KB after compression
- **CDN delivery**: <100ms (after first generation)
- **Cost**: Free tier: 1GB storage, 100GB bandwidth/month

## Error Handling

The system gracefully handles:
- ❌ API failures → Shows user-friendly error message
- ❌ Blob upload failures → Returns error, doesn't update DB
- ❌ Invalid base64 → Caught and logged
- ✅ Partial success → Recipe saved even if image fails (during creation)
