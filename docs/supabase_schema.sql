/*
  까먹지마! (Don't Forget!) - Supabase Database Schema
  복사해서 Supabase SQL Editor에 실행하세요.
*/

-- 1. 단어 세트 테이블
CREATE TABLE word_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. 단어 카드 테이블
CREATE TABLE cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES word_sets ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  is_memorized BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS) 설정
ALTER TABLE word_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 본인 것만 CRUD 가능하도록 정책 추가
CREATE POLICY "Users can manage their own word sets"
ON word_sets FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage cards in their own sets"
ON cards FOR ALL
USING (EXISTS (
  SELECT 1 FROM word_sets 
  WHERE word_sets.id = cards.set_id 
  AND word_sets.user_id = auth.uid()
));
