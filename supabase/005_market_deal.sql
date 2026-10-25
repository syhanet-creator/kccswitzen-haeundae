-- 중고장터·나눔: 거래 유형(판매/나눔/구해요). 완료 여부는 기존 status('open'/'done')를 쓴다.
alter table posts add column if not exists deal_type text;
alter table posts drop constraint if exists posts_deal_type_check;
alter table posts add constraint posts_deal_type_check check (deal_type is null or deal_type in ('sell','share','wanted'));
