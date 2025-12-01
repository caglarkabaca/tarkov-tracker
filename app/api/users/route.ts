import { NextResponse } from 'next/server'

// Örnek veri
const users = [
  { id: 1, name: 'Ahmet', email: 'ahmet@example.com' },
  { id: 2, name: 'Mehmet', email: 'mehmet@example.com' },
  { id: 3, name: 'Ayşe', email: 'ayse@example.com' },
]

export async function GET() {
  return NextResponse.json({
    users,
    count: users.length,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Yeni kullanıcı oluştur
    const newUser = {
      id: users.length + 1,
      name: body.name,
      email: body.email,
    }
    
    users.push(newUser)
    
    return NextResponse.json(
      {
        message: 'Kullanıcı başarıyla oluşturuldu',
        user: newUser,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Geçersiz istek' },
      { status: 400 }
    )
  }
}

