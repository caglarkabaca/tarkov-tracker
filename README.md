# Tarkov Quest - Tamagui + Next.js Full Stack Web App

Bu proje, Next.js 16 App Router ve Tamagui UI kütüphanesi kullanılarak oluşturulmuş modern bir full stack web uygulamasıdır.

## 🚀 Özellikler

- ⚡ **Next.js 16** - React Server Components ve App Router
- 🎨 **Tamagui** - Modern UI component kütüphanesi
- 📱 **Responsive Design** - Mobil uyumlu tasarım
- 🔥 **TypeScript** - Tip güvenli kod
- 🎯 **API Routes** - Full stack uygulama desteği
- 💅 **Tailwind CSS** - Utility-first CSS framework

## 📦 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Environment variables'ı ayarla
# .env.local dosyası oluştur ve aşağıdaki değişkenleri ekle:
# MONGODB_URI=mongodb://localhost:27017
# MONGODB_DB_NAME=tarkovquest

# GraphQL type'larını generate et (ilk kurulumda)
npm run generate:graphql

# Development server'ı başlat
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

### Environment Variables

Proje çalışması için `.env.local` dosyası oluşturmanız gerekiyor:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=tarkovquest
```

MongoDB Atlas kullanıyorsanız, connection string şu formatta olmalı:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

## 🏗️ Proje Yapısı

```
tarkovquest/
├── app/
│   ├── api/              # API routes (backend)
│   │   ├── tarkov/       # Tarkov API endpoints
│   │   │   ├── fetch/    # Data fetch endpoint
│   │   │   ├── data/     # Cached data endpoint
│   │   │   └── status/   # Fetch status endpoint
│   │   └── hello/        # Örnek API endpoint
│   ├── providers.tsx     # Tamagui Provider
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Ana sayfa
│   └── globals.css       # Global stiller
├── lib/
│   ├── db/               # Database operations
│   │   └── tarkov.ts     # Tarkov data operations
│   ├── generated/        # Generated files (git ignored)
│   │   └── graphql.ts    # GraphQL TypeScript types
│   ├── graphql/          # GraphQL utilities
│   │   └── client.ts     # GraphQL client
│   ├── types/            # Type definitions
│   │   └── tarkov.ts     # Tarkov types
│   └── mongodb.ts        # MongoDB connection
├── codegen.yml           # GraphQL Code Generator config
├── tamagui.config.ts     # Tamagui yapılandırması
└── next.config.ts        # Next.js yapılandırması
```

## 🛠️ Kullanım

### Tamagui Component'leri Kullanma

```tsx
import { Button, Card, H1, Paragraph } from 'tamagui'

export default function MyPage() {
  return (
    <Card padding="$4">
      <H1>Başlık</H1>
      <Paragraph>İçerik</Paragraph>
      <Button theme="blue">Tıkla</Button>
    </Card>
  )
}
```

### API Route Oluşturma

`app/api/` dizini altında yeni route'lar oluşturabilirsiniz:

```tsx
// app/api/example/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello API' })
}
```

## 🔄 GraphQL ve Data Fetching

### GraphQL Type Generation

Tarkov.dev API'sinden schema'yı çekip TypeScript type'larını generate etmek için:

```bash
npm run generate:graphql
```

Bu komut `lib/generated/graphql.ts` dosyasını oluşturur/günceller.

### Günlük Data Fetch

API route'ları 24 saatlik cache mekanizması ile çalışır:

- `GET /api/tarkov/fetch` - Data fetch et (cache kontrolü ile)
- `GET /api/tarkov/data` - Cache'lenmiş data'yı getir
- `GET /api/tarkov/status` - Fetch status bilgisini getir

#### Kullanım Örnekleri:

```typescript
// Status kontrolü
const status = await fetch('/api/tarkov/status?queryName=items')
const { shouldFetch, lastFetched } = await status.json()

// Data fetch (otomatik cache kontrolü)
const response = await fetch('/api/tarkov/fetch?queryName=items')
const data = await response.json()

// Force refresh
const response = await fetch('/api/tarkov/fetch?queryName=items&force=true')
const data = await response.json()

// Cached data'yı getir
const response = await fetch('/api/tarkov/data?queryName=items')
const cached = await response.json()
```

### GraphQL Query Ekleme

GraphQL query'nizi `app/api/tarkov/fetch/route.ts` dosyasındaki `DEFAULT_GRAPHQL_QUERY` değişkenini güncelleyerek veya API'ye POST request ile göndererek ekleyebilirsiniz.

## 📚 Kaynaklar

- [Next.js Dokümantasyonu](https://nextjs.org/docs)
- [Tamagui Dokümantasyonu](https://tamagui.dev/docs/intro/introduction)
- [Tamagui Components](https://tamagui.dev/docs/components/stacks)
- [Tarkov.dev API](https://api.tarkov.dev/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)

## 🚢 Deployment

Projeyi deploy etmek için:

```bash
npm run build
npm start
```

Veya Vercel, Netlify gibi platformlara deploy edebilirsiniz.

## 📝 Notlar

- Tamagui component'leri client-side'da çalışır, bu yüzden `'use client'` direktifi gerekebilir
- API routes server-side'da çalışır
- TypeScript kullanıldığı için tip güvenliği sağlanmıştır

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add some amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın
