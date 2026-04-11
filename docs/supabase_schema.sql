/*
  까먹지마! (Don't Forget!) - Supabase Database Schema
  최신 업데이트: 2024-04-11
  
  복사하여 Supabase Dashboard의 SQL Editor에서 실행하세요.
*/

-- 1. 단어 세트 테이블 (Word Sets)
CREATE TABLE IF NOT EXISTS word_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. 단어 카드 테이블 (Cards)
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES word_sets ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  image_url TEXT, -- 카드 첨부 이미지 경로
  display_order INTEGER DEFAULT 0 NOT NULL, -- 단어 리스트 표시 순서
  is_memorized BOOLEAN DEFAULT FALSE NOT NULL, -- 암기 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS) 활성화
ALTER TABLE word_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 보안 정책 (Policies)

-- word_sets: 로그인한 사용자가 자신의 세트만 관리 가능
CREATE POLICY "Users can manage their own word sets"
ON word_sets FOR ALL
USING (auth.uid() = user_id);

-- cards: 자신의 세트에 속한 카드만 관리 가능
CREATE POLICY "Users can manage cards in their own sets"
ON cards FOR ALL
USING (EXISTS (
  SELECT 1 FROM word_sets 
  WHERE word_sets.id = cards.set_id 
  AND word_sets.user_id = auth.uid()
));

/*
  [추가 안내] Storage 설정
  1. Supabase Dashboard -> Storage 메뉴 접속
  2. 'word-images'라는 이름의 새로운 Bucket 생성
  3. Public Access 허용 (또는 필요에 따라 정책 설정)
*/
