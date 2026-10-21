-- Giaodoan Merchant CRM - seed data lifted from the 14 Stitch screens.
-- Re-runnable: truncates every table first, then re-inserts. Run AFTER migrations/0001_init.sql.
-- All dates / timestamps are RELATIVE to the day you run the seed ("Con 65 ngay", "15 phut truoc" stay true).
-- Cross-screen conflicts in the designs (same merchant code, different names) are resolved in docs/DATA_MODEL.md.

truncate table
  promotion_merchants, promotion_budgets, promotions, faqs, activity_logs, churn_risks, contact_logs,
  reply_templates, ticket_messages, ticket_attachments, support_tickets,
  onboarding_tasks, onboarding_steps, onboardings,
  invoices, subscriptions, service_plans, merchant_contacts, merchants, staff
  restart identity cascade;

alter sequence merchant_code_seq restart with 3927;
alter sequence ticket_code_seq restart with 8842;
alter sequence ticket_message_seq restart with 4;
alter sequence contact_code_seq restart with 6843;
alter sequence faq_code_seq restart with 111;
alter sequence subscription_code_seq restart with 3;
alter sequence invoice_no_seq restart with 88393;

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
insert into staff (code, full_name, title, role_label, team, email, phone, ext) values
  ('GD-NV082', 'Nguyễn Văn A',     'Senior Partner Specialist', 'Onboarding Lead',     'Đội F&B Hub ĐN', 'vana.nguyen@giaodoan.vn', '+84 905 112 889', '102'),
  ('GD-NV105', 'Trần Thị B',       'Kỹ thuật POS',              'Kỹ thuật POS',        'Đội Kỹ thuật',   'tranthib@giaodoan.vn',    '+84 905 112 105', '105'),
  ('GD-NV108', 'Lê Văn C',         'Account Manager',           'Account Manager',     'Đội F&B Hub ĐN', 'levanc@giaodoan.vn',      '+84 905 112 108', '108'),
  ('GD-NV112', 'Hoàng Mỹ Linh',    'Retention Specialist',      'Chăm sóc định kỳ',    'Đội CSKH',       'linh.hoang@giaodoan.vn',  '+84 905 112 112', '112'),
  ('GD-NV120', 'Lê Mai Hương',     'Trưởng nhóm Vận hành F&B',  'Trưởng nhóm Vận hành','Đội Vận hành',   'huong.le@giaodoan.vn',    '+84 905 112 120', '120'),
  ('GD-NV121', 'Trần Quốc Quân',   'Chuyên viên Đối tác',       'Chuyên viên Đối tác', 'Đội Đối tác',    'quan.tran@giaodoan.vn',   '+84 905 112 121', '121'),
  ('GD-NV122', 'Võ Thị Thu',       'Hỗ trợ Merchant',           'Hỗ trợ Merchant',     'Đội CSKH',       'thu.vo@giaodoan.vn',      '+84 905 112 122', '122'),
  ('GD-NV123', 'Lê Thanh',         'Admin CSKH',                'Admin CSKH',          'Đội CSKH',       'thanh.le@giaodoan.vn',    '+84 905 112 123', '123'),
  ('GD-NV124', 'Phạm Thu Hà',      'CSKH Admin',                'CSKH Admin',          'Đội CSKH',       'ha.pham@giaodoan.vn',     '+84 905 112 124', '124');

-- ---------------------------------------------------------------------------
-- merchants (13). Codes MC-3926 ... MC-3914. status values: onboarding | active | new | consulted | stopped
-- ---------------------------------------------------------------------------
insert into merchants (code, name, category, status, phone, address, address_full, region, district,
                       contact_name, contact_title, email, icon, emoji, image_url,
                       account_manager_id, created_by_id, created_at)
select v.code, v.name, v.category, v.status, v.phone, v.address, v.address_full, v.region, v.district,
       v.contact_name, v.contact_title, v.email, v.icon, v.emoji, v.image_url,
       am.id, cb.id, now() - (v.age_days || ' days')::interval
from (values
  ('MC-3926', 'Whisper Coffee & Lounge', 'Cà phê & Đồ uống chill ban đêm', 'onboarding', '+84 935 413 191',
   '140/11 Hải Phòng, Hải Châu, Đà Nẵng', '140/11 Hải Phòng, Phường Thạch Thang, Quận Hải Châu, TP. Đà Nẵng', 'Đà Nẵng', 'Hải Châu',
   'Trần Đình Khang', 'Chủ cơ sở / Người đại diện pháp luật hộ kinh doanh', 'whisper.coffee.dn@gmail.com', 'local_cafe', '☕', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB822Kyu0Txq8P9CyjjYPXScTzyn5oME-8gWy1b0nyVfZYH71utmQKqLLV1FlSvPkz7X2zPOJD5HbOcCEbMTel4zKWjmLuiqEEMel03YOvl3vtTAT9kQKajzhe-PhT0V_WSqKXiepegvz5gA8IRAH4p18baQAMCZNOG3KTVlnlLQnj59FHLVnl6W4r7k29MjPX_cbx_RbUfKqsKrVOMk_6utHqjlUoaZQzhymXOM0KsCCL986pHI-Hl', 'GD-NV082', 'GD-NV082', 12),
  ('MC-3925', 'Quán Hủ Tiếu Dai Đà Thành', 'Ẩm thực truyền thống Đà Nẵng', 'active', '+84 911 198 843',
   '112 Cù Chính Lan, Thanh Khê, Đà Nẵng', '112 Cù Chính Lan, P. Hòa Khê, Q. Thanh Khê, TP. Đà Nẵng', 'Đà Nẵng', 'Thanh Khê',
   'Trần Đình Khoa', 'Quản lý', 'hutieudai.dathanh@gmail.com', 'ramen_dining', '🍜', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQCncJwbWRy8U1IeWqf0pcWbptlkbCMQcp77kPJ3oaqPg-xe-jat_Fs4LB3Vol4WIJvN874DRTMoYNv1YFUTfoTN1SP3qdFwP5w46JYgykNHOmlh8se5jL8FGFl76mOz7k1UDn5BjqxGrY9e6BjHUZfZmo7i5PwpHtPIAW4OLopiT3HRmW0RZs5_cGroFCn7reQ_joLdn2ahzuL3kL1g0Vtd6eHyauO9Gl9mNju3vGKcaQQNPXfYek', 'GD-NV120', 'GD-NV120', 14),
  ('MC-3924', 'Ancora Cocktail Bar', 'Cocktail Lounge & Tapas cao cấp', 'active', '+84 908 672 901',
   '7A Xuân Thủy, Thảo Điền, TP. Thủ Đức', '7A Xuân Thủy, P. Thảo Điền, TP. Thủ Đức, TP. HCM', 'TP. Hồ Chí Minh', 'Thủ Đức',
   'Hoàng Minh Trí', 'Chủ quán', 'ancora.bar@gmail.com', 'wine_bar', '🍸', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTooohU1fJSjoYtZV62f9jouRosg1FCLmEZ0-DFPd7le5J7sNxsYtqb0mJLZa4hIJ_Kn63sDda8HvXz0G92MxHq2TmWVfgHCPb37iZtxA_l2SHh4rI-I3JYYx8Vbb9xt3FWR7rgepXSWyaQwQHXKdZubPH9fBT5PejIefqDTRxVXsnVWw8Jbbt-FiPfEuFuYdTjCjP3WZ4vaV4XGoiE6-yMrpCow6ESTgX3aUPf_WS2ThGkCySv7N3', 'GD-NV108', 'GD-NV121', 17),
  ('MC-3923', 'Phở Trâu Tươi Bắc Ninh', 'Đặc sản phở trâu giật gia truyền', 'stopped', '+84 982 301 445',
   '24 Lý Thường Kiệt, TP. Bắc Ninh', '24 Lý Thường Kiệt, P. Suối Hoa, TP. Bắc Ninh, Bắc Ninh', 'Bắc Ninh', 'TP. Bắc Ninh',
   'Nguyễn Văn Phúc', 'Chủ quán', 'photrau.bacninh@gmail.com', 'soup_kitchen', '🍲', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB6wbllIN5ODo06plW5QtBKkcyZonuy-a7mInXeI9IN9sn4EkFuuGMRJGlpjrKN_oGmBiXphlFGuD-3vZzRVqpVri0K5Ffm7ph6f8qEd5dW4vLGzJJfmTujwncq2sOdXr6Y1uED74nX-IbMnEd7wwo48ZsbSB9u6zkOvnjdLldhDtOrigAoiUswYLMd8QHrSeQBRCLzH308_z7tW6eVLNpELW-W1MdSMy0xtu0vi3FaSdxp1_zFsEQo', 'GD-NV108', 'GD-NV082', 25),
  ('MC-3922', 'Chè Huế Cung Đình 1979', 'Chè cung đình & Tráng miệng truyền thống', 'new', '+84 974 559 102',
   '58 Mai Thúc Loan, Thuận Thành, TP. Huế', '58 Mai Thúc Loan, P. Thuận Thành, TP. Huế, Thừa Thiên Huế', 'Huế', 'Thuận Thành',
   'Tôn Nữ Ý Nhi', 'Đại diện', 'chehue1979@gmail.com', 'icecream', '🍧', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDz9rTWCMJPUiY0w-PomutumSAeZAZCp21Z7I71vErdVD9oVz4eD12OAXMOHUfJERKDsuhYNgLB33ykbWB_lF7jj0IuRFLZmErTO8S6hibgTYW8v3ethrLKyPFDMm8ERt58NTwx6ZvTb1kZh2oI6TVKy7GJ0vBbVowGC9zJRN7ERkipHNpIkjPACN1IMzfwEmcRQT_fO8lTzCqnwSubRH-Gh2nSI-kLMug2YjUs9S9jVge8tfVOLsn4', 'GD-NV112', 'GD-NV082', 33),
  ('MC-3921', 'Bánh Mì Tuấn Sài Gòn', 'Bánh mì kẹp & Đồ ăn sáng mang đi', 'consulted', '+84 903 124 999',
   '214 Nguyễn Trãi, Phường 3, Quận 5, TP. HCM', '214 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Quận 5',
   'Phan Anh Tuấn', 'Chủ chuỗi 3 chi nhánh', 'banhmituan.sg@gmail.com', 'bakery_dining', '🥖', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDndFvbYJkRlnjiUBacnnB5EKd7yfIFostLHXbp-I-NdB67F3VKjDCGGY7zvt5XIE5C1ViwLffQM65k8orPO8uIwWKP7_0Jy0KC10tNiNx2VSLxC3JUhWzGovmt5938sE3B2nrvWnO8vwDJ_1kUpBRYjLA5hMr_HdLCYmqiYQjrLKT9lKkcmF5cRGfTpwTyxAUFy2UtVxFm72xIpt3RozSdhI5omEifXSJrlVACNpM0rYciv1IQ1eWT', 'GD-NV122', 'GD-NV121', 40),
  ('MC-3920', 'Vĩnh Hòa Dimsum', 'Ẩm thực Quảng Đông & Trà đạo', 'active', '+84 945 882 133',
   '45 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', '45 Trần Hưng Đạo, P. Trần Hưng Đạo, Q. Hoàn Kiếm, Hà Nội', 'Hà Nội', 'Hoàn Kiếm',
   'Lâm Vĩnh Hòa', 'Chủ quán', 'vinhhoa.dimsum@gmail.com', 'restaurant', '🥟', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLmfyHcbAMRg64A6aIgoV85hzSOFmvjlSLf5_4RA2-vl-mE5BbRr6YyvP5jdWzwtKCz7lvxOuuIGW1RJbp3vMd4p7c0D1FvBaSyuqyOCtfBT1n_DPytc-iK2L8gHpCPBvd-umi8SE-CZFKPEBNfkRAFPqYG3ZPhznNjzY9RLP2KUvXfUs60wLZDW_FsxhRHfwc2TAB1jJfiEDxIAS6ZAcIm5nBhUK74l3poYpyfaPeiOqynwUSpnz7', 'GD-NV108', 'GD-NV121', 55),
  ('MC-3919', 'Cháo Nghêu Hội An', 'Cháo & Hải sản Hội An', 'active', '+84 918 332 901',
   '45 Cửa Đại, TP. Hội An, Quảng Nam', '45 Cửa Đại, P. Cửa Đại, TP. Hội An, Quảng Nam', 'Quảng Nam', 'Hội An',
   'Nguyễn Thị Lụa', 'Chủ quán', 'chaongheu.hoian@gmail.com', 'set_meal', '🥣', null, 'GD-NV082', 'GD-NV082', 80),
  ('MC-3918', 'Phở Gia Truyền Bát Đàn', 'Phở bò gia truyền Hà Nội', 'active', '+84 912 450 677',
   '49 Bát Đàn, Cửa Đông, Hoàn Kiếm, Hà Nội', '49 Bát Đàn, P. Cửa Đông, Q. Hoàn Kiếm, Hà Nội', 'Hà Nội', 'Hoàn Kiếm',
   'Nguyễn Văn Đàn', 'Chủ quán', 'phobatdan@gmail.com', 'ramen_dining', '🍜', null, 'GD-NV108', 'GD-NV121', 120),
  ('MC-3917', 'Pizza 4P''s Signature', 'Pizza lò củi kiểu Nhật & Phô mai tươi', 'active', '+84 901 888 444',
   '8/15 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. HCM', '8/15 Lê Thánh Tôn, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Quận 1',
   'Trần Thanh Hải', 'Quản lý khu vực', 'signature@pizza4ps.example', 'local_pizza', '🍕', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPxSzpY9hcBN0PtPL7SUbAyrm1yfbJKXagYFyOzvzMjyztPgAPgaKdjhLhffuhuc1nrjtROjj0XXql_PmDuV2K9Yv_Fy0Fn-bsKJv8LLO1CYwd_Vhh2GXxGy8QNGUHSIZ_AspjwYYSeLV9UFT6PYU6oUD51aHrMTrA8Dq-a-uw1-uFicFaXYMVm89uPVS-74ulmCPP8lRCDV4JDHvI9MptmQlLghFulHJVaTaze2gOBzarCRKWR70q', 'GD-NV108', 'GD-NV120', 200),
  ('MC-3916', 'Maison de Brioche', 'Bánh ngọt & Brioche Pháp', 'onboarding', '+84 936 270 118',
   '12 Quảng An, Tây Hồ, Hà Nội', '12 Quảng An, P. Quảng An, Q. Tây Hồ, Hà Nội', 'Hà Nội', 'Tây Hồ',
   'Đỗ Thu Trang', 'Chủ quán', 'maison.brioche@gmail.com', 'bakery_dining', '🥐', null, 'GD-NV082', 'GD-NV082', 9),
  ('MC-3915', 'Nem Nướng Nha Trang Cô Ba', 'Nem nướng & Đặc sản Nha Trang', 'onboarding', '+84 979 123 456',
   '54 Võ Văn Kiệt, An Hải Đông, Sơn Trà, Đà Nẵng', '54 Võ Văn Kiệt, P. An Hải Đông, Q. Sơn Trà, TP. Đà Nẵng', 'Đà Nẵng', 'Sơn Trà',
   'Nguyễn Thị Ba', 'Chủ quán', 'nemnuong.coba@gmail.com', 'lunch_dining', '🍢', null, 'GD-NV120', 'GD-NV120', 6),
  ('MC-3914', 'Cơm Niêu Phù Đổng', 'Cơm niêu & Món Việt gia đình', 'active', '+84 967 004 215',
   '21 Phù Đổng Thiên Vương, Phường 8, Đà Lạt', '21 Phù Đổng Thiên Vương, Phường 8, TP. Đà Lạt, Lâm Đồng', 'Lâm Đồng', 'Đà Lạt',
   'Mai Thị Mai', 'Kế toán trưởng', 'comnieu.phudong@gmail.com', 'rice_bowl', '🍲', null, 'GD-NV105', 'GD-NV120', 300)
) as v(code, name, category, status, phone, address, address_full, region, district,
       contact_name, contact_title, email, icon, emoji, image_url, am_code, cb_code, age_days)
left join staff am on am.code = v.am_code
left join staff cb on cb.code = v.cb_code;

-- commercial / operating stats for every merchant
update merchants m set
  gmv_month_vnd = s.gmv, gmv_growth_pct = s.growth, orders_month = s.orders, completion_rate_pct = s.completion,
  aov_vnd = s.aov, best_seller = s.best, prep_time_min = s.prep, take_rate_pct = s.take_rate,
  payout_schedule = s.payout, bank_account = s.bank,
  contract_end = case when s.contract_days is null then null else current_date + s.contract_days end,
  stats_updated_at = now() - interval '10 minutes'
from (values
  ('MC-3926',  48250000,  14.2,  864, 98.4,  55800, 'Cold Brew Mơ',            7.2, 18.5, 'Thứ 3 & Thứ 6 hàng tuần', 'MB Bank - 8839268888',          65),
  ('MC-3925',  62400000,   6.1, 1120, 97.2,  55700, 'Hủ tiếu bò kho',          9.5, 15.0, 'Thứ 2 hàng tuần',         'Vietcombank - 0041000112233',   18),
  ('MC-3924', 118500000,   9.8,  740, 96.8, 160000, 'Negroni Signature',      12.0, 12.0, 'Thứ 2 & Thứ 5 hàng tuần', 'Techcombank - 19036688001',     24),
  ('MC-3923',  21800000, -12.5,  310, 94.1,  70300, 'Phở trâu tái nạm',       11.0, 18.0, 'Thứ 2 hàng tuần',         'BIDV - 21510008899',            90),
  ('MC-3922',  15400000,   2.4,  420, 95.6,  36600, 'Chè thập cẩm',            6.5, 20.0, 'Thứ 6 hàng tuần',         'Agribank - 4401205009911',       2),
  ('MC-3921',  44300000,   3.3, 1530, 96.0,  29000, 'Bánh mì thịt nguội',      5.0, 18.0, 'Thứ 3 & Thứ 6 hàng tuần', 'ACB - 245688910',               23),
  ('MC-3920',  89700000,  11.0,  980, 98.0,  91500, 'Há cảo tôm',             14.0, 15.0, 'Thứ 2 hàng tuần',         'VPBank - 1234567890',           195),
  ('MC-3919',  33200000,   5.2,  560, 97.5,  59300, 'Cháo nghêu',             10.0, 12.0, 'Thứ 2 hàng tuần',         'Sacombank - 060112345678',      335),
  ('MC-3918',  71500000,   7.7, 1210, 98.9,  59100, 'Phở tái lăn',             8.0, 15.0, 'Thứ 3 & Thứ 6 hàng tuần', 'MB Bank - 0334455667',          299),
  ('MC-3917', 164000000,  13.1, 1650, 99.1,  99400, 'Pizza 4 loại phô mai',   15.0, 12.0, 'Thứ 2 & Thứ 5 hàng tuần', 'HSBC - 001-234567-890',        120),
  ('MC-3916',   8200000,   0.0,   95, 93.0,  86300, 'Croissant bơ',            8.0, 18.0, 'Thứ 6 hàng tuần',         'VIB - 0123456789',              null),
  ('MC-3915',  12600000,   0.0,  210, 94.0,  60000, 'Nem nướng cuốn',          9.0, 18.0, 'Thứ 6 hàng tuần',         'MB Bank - 0987001122',          null),
  ('MC-3914',  38900000,   4.5,  700, 97.0,  55500, 'Cơm niêu cá kho',        13.0, 18.0, 'Thứ 2 hàng tuần',         'Vietcombank - 0071001889900',    60)
) as s(code, gmv, growth, orders, completion, aov, best, prep, take_rate, payout, bank, contract_days)
where m.code = s.code;

-- Whisper Coffee & Lounge: full detail-page content
update merchants set
  personal_email = 'khang.trandinh.92@gmail.com',
  area_label = 'Trung tâm Hải Châu',
  lat = 16.07548, lng = 108.21981,
  delivery_radius_km = 6.5, pickup_time_label = '5 - 8 phút', is_open = true,
  contact_verified = true, call_hours = '08:00 - 22:30 hàng ngày',
  zalo_group = '[GD] Whisper Lounge Support',
  zalo_group_note = 'Gồm 4 thành viên (1 Quản lý F&B + 3 NV Vận hành Giaodoan)',
  business_license = 'GPKD-2024/DN-771', tax_code = '0401889922',
  branch_type = 'Chi nhánh Độc lập', partner_tier = 'Platinum Partner',
  cover_url = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxwXzWPnPxKj1FRw7zLF6zArXDUIxRa3pKmd2nmOgdMX9rCEYnnTBY0FmlsJjccECgRU9NkuWgWvL6apku_n8g3ybd_TaFDbAa1oZF7Ye8cFNW4KdhasYWVGwSlIdk_syeqlR077YuLj7l649Hc4cwlpCbyTYVWF0fRC523CS8vbVRmH_3t7lwzfg369pkaILtkXrCocmExWl5xQc08CPU8kOu2gYCm5YW_oFjwKSSyQheHqlFNbMI', map_url = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyW7w7yQwacKiwSKktnT9GQApWfqrc_uWJMeLGomuJ3PzuP2GjrG7D0bFpCaYICxR4et5CqJeq1rbZYY3ums2DFHBoQT1L7IedvF312UR1L_za1qOCwdnt5UXuV9UhNiNBZJ_qB9sKEJSOcFg2fZ1v9RD61JvqAEYaVqu8p4DVKXrjjNKSYOP-mGh8yy2khyZRh8SYG4ul-WT91vo3AcE6Y1H6UIeK-fqLSky9TCIqVCTQVUNHiv_Q'
where code = 'MC-3926';

-- generic defaults so every detail page renders
update merchants set
  delivery_radius_km = coalesce(delivery_radius_km, 5.0),
  pickup_time_label = coalesce(pickup_time_label, '6 - 10 phút'),
  area_label = coalesce(area_label, 'Khu vực ' || district),
  contact_verified = true,
  call_hours = coalesce(call_hours, '08:00 - 22:00 hàng ngày'),
  business_license = coalesce(business_license, 'GPKD-2024/' || right(code, 4)),
  tax_code = coalesce(tax_code, '0401' || right(code, 4) || '22'),
  branch_type = coalesce(branch_type, 'Chi nhánh Độc lập'),
  is_open = (status <> 'stopped');

insert into merchant_contacts (merchant_id, full_name, title, phone, sort_order)
select m.id, v.full_name, v.title, v.phone, v.sort_order
from (values
  ('MC-3926', 'Trần Minh Long', 'Chủ cơ sở (Quản lý chung)',   '+84 935 413 191', 1),
  ('MC-3926', 'Nguyễn Thu Nga', 'Cửa hàng trưởng / Thu ngân', '+84 905 220 118', 2),
  ('MC-3925', 'Trần Đình Khoa', 'Quản lý',                     '+84 911 198 843', 1),
  ('MC-3924', 'Hoàng Minh Trí', 'Chủ quán',                    '+84 905 882 120', 1),
  ('MC-3922', 'Tôn Nữ Ý Nhi',   'Đại diện',                    '+84 947 220 909', 1),
  ('MC-3921', 'Phan Anh Tuấn',  'Chủ chuỗi 3 chi nhánh',       '+84 903 552 147', 1),
  ('MC-3915', 'Nguyễn Thị Ba',  'Chủ quán',                    '+84 979 123 456', 1)
) as v(code, full_name, title, phone, sort_order)
join merchants m on m.code = v.code;

-- ---------------------------------------------------------------------------
-- service plans
-- ---------------------------------------------------------------------------
insert into service_plans (code, name, tier_label, badge, icon, price_month_vnd, price_year_vnd, year_note, commission_pct, features, sort_order) values
  ('silver', 'Gói Bạc (Silver)', 'Gói Khởi Điểm', null, 'workspace_premium', 1200000, 12000000,
   'Hoặc 12.000.000 đ / năm (Tiết kiệm 2 tháng)', 18,
   array['Phí chiết khấu ưu đãi sàn: 18%', 'Hỗ trợ kỹ thuật tiêu chuẩn SLA < 4h', 'Tích hợp kết nối máy POS bán hàng cơ bản'], 1),
  ('gold', 'Gói Vàng (Gold)', 'Gói Tối Ưu', 'Phổ biến nhất • Best Value', 'stars', 2500000, 25000000,
   'Hoặc 25.000.000 đ / năm (Tặng 2 tháng)', 15,
   array['Phí chiết khấu ưu tiên đặc biệt: 15%', 'Hỗ trợ sự cố khẩn cấp SLA < 1h', 'Tặng gói Marketing đẩy TOP tìm kiếm quận/huyện', 'Quản lý chuỗi đa điểm tập trung'], 2),
  ('diamond', 'Gói Kim Cương', 'Gói Đặc Quyền VIP', null, 'diamond', 5000000, 50000000,
   'Hoặc 50.000.000 đ / năm (Tặng máy POS Sunmi)', 12,
   array['Phí chiết khấu độc quyền siêu tiết kiệm: 12%', 'Chuyên viên Quản lý Đối tác (AM 1-1) trực 24/7', 'Đồng bộ API ERP, SAP, KiotViet tùy biến', 'Trang bị miễn phí trọn đời máy Sunmi POS'], 3);

-- ---------------------------------------------------------------------------
-- subscriptions (contracts). is_current = the contract shown in the /subscriptions list
-- ---------------------------------------------------------------------------
insert into subscriptions (code, merchant_id, plan_id, plan_name, plan_tier, cycle_months, cycle_label, contract_note,
                           list_price_vnd, discount_pct, amount_vnd, signed_at, start_date, end_date,
                           status, is_current, auto_renew, payment_method, payment_ref, benefits, account_manager_id)
select v.code, m.id, p.id, v.plan_name, v.plan_tier, v.cycle_months, v.cycle_label, v.contract_note,
       v.list_price, v.discount, v.amount, v.signed_at, v.start_date, v.end_date,
       v.status, v.is_current, v.auto_renew, v.pay_method, v.pay_ref, v.benefits::jsonb, am.id
from (values
  -- Whisper: 3 contracts (history table on the detail page)
  ('MC-3926', 'GDV-GLD-02', 'gold', 'Gói Vàng (Gold)', 'gold', 12, '12 Tháng', 'Hợp đồng 1 năm (Ưu tiên Top Search)',
   11988000, 10.0, 10800000, current_date - 306, current_date - 299, current_date + 65, 'active', true, false,
   'Chuyển khoản VCB', '#VCB-8839210',
   '[{"icon":"rocket_launch","title":"Ưu tiên đẩy Top tìm kiếm","description":"Tối ưu bán kính 5km trên app thực khách Giaodoan, gia tăng 35% lượt tiếp cận và đặt bàn."},{"icon":"percent","title":"Chiết khấu hoa hồng ưu đãi 12%","description":"Tiết kiệm 3% so với mức tiêu chuẩn 15% cho từng đơn hàng hoàn tất qua ứng dụng."},{"icon":"campaign","title":"Đồng hành Marketing & Banner","description":"Slot xuất hiện miễn phí trong 02 chiến dịch Flash Sale thương hiệu và lễ hội ẩm thực mỗi quý."},{"icon":"support_agent","title":"Kênh hỗ trợ VIP SLA < 2 Giờ","description":"Đường dây nóng xử lý sự cố thiết bị POS, cập nhật thực đơn và vận hành ưu tiên 24/7."}]'),
  ('MC-3926', 'GDV-SLV-01', 'silver', 'Gói Bạc (Silver)', 'silver', 6, '06 Tháng', 'Hợp đồng 6 tháng',
   2700000, 0, 2700000, current_date - 499, current_date - 483, current_date - 300, 'completed', false, false,
   'Chuyển khoản VCB', '#VCB-7710042', '[]'),
  ('MC-3926', 'GDV-TRI-00', null, 'Dùng Thử Khai Trương', 'trial', null, '15 Ngày', 'Dùng thử miễn phí khi khai trương',
   0, 0, 0, current_date - 499, current_date - 499, current_date - 484, 'completed', false, false,
   null, null, '[]'),
  -- other merchants: one current contract each
  ('MC-3925', 'GD-GLD-3925', 'gold', 'Gói Vàng (Gold)', 'gold', 12, '12 Tháng', 'Hợp đồng 1 năm (Top Search)',
   25000000, 0, 25000000, current_date - 354, current_date - 347, current_date + 18, 'active', true, false,
   'Chuyển khoản Vietcombank', '#VCB-5520113', '[]'),
  ('MC-3924', 'GD-DMD-3924', 'diamond', 'Gói Kim Cương', 'diamond', 1, '01 Tháng', 'Hợp đồng tháng (Tự động gia hạn)',
   5000000, 0, 5000000, current_date - 8, current_date - 7, current_date + 24, 'active', true, true,
   'Thẻ tín dụng', '#CC-9910022', '[]'),
  ('MC-3922', 'GD-SLV-3922', 'silver', 'Gói Bạc (Silver)', 'silver', 12, '12 Tháng', 'Hợp đồng 1 năm (POS Chuẩn)',
   12000000, 0, 12000000, current_date - 210, current_date - 203, current_date + 162, 'active', true, false,
   'Chuyển khoản Agribank', '#AGR-3300871', '[]'),
  ('MC-3921', 'GD-SLV-3921', 'silver', 'Gói Bạc (Silver)', 'silver', 1, '01 Tháng', 'Gói 1 tháng (Đăng ký mới)',
   1200000, 0, 1200000, current_date - 8, current_date - 7, current_date + 23, 'active', true, false,
   'Ví MoMo', '#MM-20011874', '[]'),
  ('MC-3920', 'GD-GLD-3920', 'gold', 'Gói Vàng (Gold)', 'gold', 12, '12 Tháng', 'Hợp đồng 1 năm (Chiết khấu 15%)',
   25000000, 0, 25000000, current_date - 177, current_date - 170, current_date + 195, 'active', true, false,
   'Chuyển khoản VPBank', '#VPB-1188220', '[]'),
  ('MC-3919', 'GD-DMD-3919', 'diamond', 'Gói Kim Cương', 'diamond', 12, '12 Tháng', 'Hợp đồng 1 năm (Account VIP)',
   50000000, 0, 50000000, current_date - 36, current_date - 30, current_date + 335, 'active', true, false,
   'Chuyển khoản Sacombank', '#SCB-7766120', '[]'),
  ('MC-3918', 'GD-GLD-3918', 'gold', 'Gói Vàng (Gold)', 'gold', 12, '12 Tháng', 'Hợp đồng 1 năm (Chiết khấu 15%)',
   25000000, 0, 25000000, current_date - 72, current_date - 66, current_date + 299, 'active', true, false,
   'Chuyển khoản MB Bank', '#MB-4421907', '[]'),
  ('MC-3917', 'GD-DMD-3917', 'diamond', 'Gói Kim Cương', 'diamond', 12, '12 Tháng', 'Hợp đồng 1 năm (Sunmi POS)',
   50000000, 0, 50000000, current_date - 252, current_date - 245, current_date + 120, 'active', true, false,
   'Chuyển khoản HSBC', '#HSB-9023311', '[]'),
  ('MC-3914', 'GD-SLV-3914', 'silver', 'Gói Bạc (Silver)', 'silver', 12, '12 Tháng', 'Hợp đồng 1 năm (POS Chuẩn)',
   12000000, 0, 12000000, current_date - 312, current_date - 305, current_date + 60, 'active', true, false,
   'Chuyển khoản Vietcombank', '#VCB-6600118', '[]')
) as v(mcode, code, plan_code, plan_name, plan_tier, cycle_months, cycle_label, contract_note,
       list_price, discount, amount, signed_at, start_date, end_date, status, is_current, auto_renew,
       pay_method, pay_ref, benefits)
join merchants m on m.code = v.mcode
left join service_plans p on p.code = v.plan_code
left join staff am on am.code = 'GD-NV082';

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
insert into invoices (number, merchant_id, subscription_id, issued_at, einvoice_series, einvoice_no, status, line_title,
                      term_months, list_price_vnd, discount_vnd, discount_pct, total_vnd, amount_in_words, vat_note,
                      previous_contract_code, previous_end_date, new_start_date, new_end_date,
                      payment_method, payment_ref, payment_note,
                      merchant_rep_name, merchant_rep_phone, merchant_signed_at, merchant_sign_provider,
                      issuer_unit, issuer_staff_id, issuer_sign_note)
select v.number, m.id, s.id, v.issued_at, v.series, v.einv_no, 'paid', v.line_title,
       v.term, v.list_price, v.discount_vnd, v.discount_pct, v.total, v.words, '(VAT 0% phần mềm)',
       v.prev_code, v.prev_end, s.start_date, s.end_date,
       v.pay_method, v.pay_ref, 'Khớp lệnh tự động qua OpenBanking',
       v.rep, v.rep_phone, v.issued_at + interval '35 minutes', v.sign_provider,
       'Phòng Quản lý & Phát triển Đối tác Giaodoan - Miền Trung', am.id, 'Ký số Viettel-CA • GD-AUTH-8839'
from (values
  ('HD-2025-88392', 'MC-3926', 'GDV-GLD-02', (current_date - 306)::timestamp + time '14:35:20', '1C24TGD', '0029841',
   'Gói Dịch Vụ Vàng (Gold Plan F&B) - Quản Trị Merchant Chuyên Nghiệp', 12, 11988000, 1188000, 10.0, 10800000,
   'Mười triệu tám trăm nghìn đồng chẵn./.', 'GDV-SLV-01', current_date - 300, 'Chuyển khoản Vietcombank', 'VCB-8839210',
   'Trần Minh Long', '+84 935 413 191', 'VNPT-CA'),
  ('HD-2024-77120', 'MC-3926', 'GDV-SLV-01', (current_date - 499)::timestamp + time '09:12:00', '1C24TGD', '0017720',
   'Gói Dịch Vụ Bạc (Silver Plan F&B) - 06 tháng', 6, 2700000, 0, 0, 2700000,
   'Hai triệu bảy trăm nghìn đồng chẵn./.', null, null, 'Chuyển khoản Vietcombank', 'VCB-7710042',
   'Trần Minh Long', '+84 935 413 191', 'VNPT-CA'),
  ('HD-2025-88101', 'MC-3925', 'GD-GLD-3925', (current_date - 354)::timestamp + time '10:20:00', '1C24TGD', '0029110',
   'Gói Dịch Vụ Vàng (Gold Plan F&B) - 12 tháng', 12, 25000000, 0, 0, 25000000,
   'Hai mươi lăm triệu đồng chẵn./.', null, null, 'Chuyển khoản Vietcombank', 'VCB-5520113',
   'Trần Đình Khoa', '+84 911 198 843', 'VNPT-CA')
) as v(number, mcode, scode, issued_at, series, einv_no, line_title, term, list_price, discount_vnd, discount_pct, total,
       words, prev_code, prev_end, pay_method, pay_ref, rep, rep_phone, sign_provider)
join merchants m on m.code = v.mcode
join subscriptions s on s.code = v.scode
left join staff am on am.code = 'GD-NV082';

-- ---------------------------------------------------------------------------
-- onboarding (7 merchants). steps_done 1..5 drives the list chips (1 Tai khoan ... 5 Hoan thanh)
-- ---------------------------------------------------------------------------
insert into onboardings (merchant_id, assignee_id, steps_done, owner_label, started_at, go_live_date, sla_note, sla_detail)
select m.id, st.id, v.steps_done, v.owner_label, now() - (v.started_days || ' days')::interval,
       case when v.go_live_days is null then null else current_date + v.go_live_days end, v.sla_note, v.sla_detail
from (values
  ('MC-3926', 'GD-NV082', 3, 'Chủ sở hữu: Lê Văn Nam', 3, 6,
   'Tốc độ hoàn thành: Nhanh hơn 1.5 ngày so với SLA chuẩn',
   'Nhờ đối tác cung cấp hồ sơ thuế và ảnh chụp thực đơn có sẵn định dạng số.'),
  ('MC-3925', 'GD-NV120', 1, 'Quản lý: Trần Đình Khoa',     6, 2,    null, null),
  ('MC-3924', 'GD-NV121', 2, 'Chủ quán: Hoàng Minh Trí',    5, 4,    null, null),
  ('MC-3922', 'GD-NV082', 4, 'Đại diện: Bà Tôn Nữ Ý Nhi',   8, 1,    null, null),
  ('MC-3921', 'GD-NV122', 5, 'Chủ quán: Phan Anh Tuấn',     9, null, null, null),
  ('MC-3915', 'GD-NV120', 3, 'Chủ quán: Nguyễn Thị Ba',     4, 5,    null, null),
  ('MC-3916', 'GD-NV082', 1, 'Chủ quán: Đỗ Thu Trang',      2, 9,    null, null)
) as v(mcode, staff_code, steps_done, owner_label, started_days, go_live_days, sla_note, sla_detail)
join merchants m on m.code = v.mcode
left join staff st on st.code = v.staff_code;

insert into onboarding_steps (onboarding_id, step_no, title, description, status, completed_at, completed_by)
select o.id, s.n, s.title, s.descr,
       case when s.n <= o.steps_done then 'done' when s.n = o.steps_done + 1 then 'in_progress' else 'pending' end,
       case when s.n <= o.steps_done then o.started_at + (s.n || ' days')::interval else null end,
       case when s.n <= o.steps_done then st.full_name else null end
from onboardings o
left join staff st on st.id = o.assignee_id
cross join (values
  (1, 'Tạo tài khoản & Phê duyệt thông tin pháp lý', 'Thu thập và xác minh giấy phép kinh doanh F&B, CCCD đại diện pháp luật, giấy chứng nhận vệ sinh an toàn thực phẩm. Ký hợp đồng hợp tác số điện tử.'),
  (2, 'Thiết lập cửa hàng & Cấu hình giờ hoạt động, địa chỉ, tài khoản ngân hàng', 'Định vị tọa độ quán trên bản đồ, cài đặt bán kính giao hàng tối ưu, lịch mở cửa và cấu hình tài khoản nhận thanh toán.'),
  (3, 'Đồng bộ Menu món ăn & Giá bán', 'Tải lên danh mục món, hình ảnh chuẩn HD, gắn tag phân loại (Bestseller, Món mới) và cấu hình tuỳ chọn topping/đường/đá.'),
  (4, 'Tạo Chương trình khuyến mãi (CTKM) khai trương & Cài đặt POS/App', 'Hỗ trợ quán thiết lập voucher giảm giá đặc biệt dịp ra mắt, cấp quyền truy cập app quản trị Giaodoan Merchant POS và cấu hình máy in hóa đơn.'),
  (5, 'Chạy đơn thử nghiệm & Nghiệm thu bàn giao', 'Tạo 1 đơn đặt hàng giả lập từ ứng dụng khách hàng Giaodoan, tài xế nhận đơn, in phiếu bếp và hoàn tất luồng thanh toán giao dịch mẫu trước khi chính thức Go-Live.')
) as s(n, title, descr);

-- Whisper step details (onboarding detail screen)
update onboarding_steps os set
  description = d.description, completed_by = d.completed_by, completed_at = d.completed_at, planned_label = d.planned_label,
  meta = d.meta::jsonb, guide_goal = d.guide_goal, guide_checklist = coalesce(d.guide_checklist, '{}')
from (
  select o.id as onboarding_id, v.n, v.description, v.completed_by,
         case when v.hours is null then null else o.started_at + (v.hours || ' hours')::interval end as completed_at,
         v.planned_label, v.meta, v.guide_goal, v.guide_checklist
  from onboardings o
  join merchants m on m.id = o.merchant_id and m.code = 'MC-3926'
  cross join (values
    (1, 'Thu thập và xác minh giấy phép kinh doanh F&B, CCCD đại diện pháp luật, giấy chứng nhận vệ sinh an toàn thực phẩm. Ký hợp đồng hợp tác số điện tử.',
     'Admin CSKH (Lê Thanh)', 8, null::text, '{"approver":"Admin CSKH (Lê Thanh)","document":"Xem hồ sơ điện tử (.PDF)"}', null::text, null::text[]),
    (2, 'Định vị tọa độ quán trên bản đồ Đà Nẵng, cài đặt bán kính giao hàng tối ưu (5.5 km), lịch mở cửa 07:00 - 23:00 và cấu hình tài khoản nhận thanh toán Vietcombank.',
     'Nguyễn Văn A', 28, null, '{"performed_by":"Nguyễn Văn A","bank":"VCB - 0041000392819 (Đã khớp)","radius_km":5.5,"hours":"07:00 - 23:00"}', null, null),
    (3, 'Tải lên danh mục 45 món cà phê thủ công, mocktail và bánh pastry. Đã thiết lập hình ảnh chuẩn HD, gắn tag phân loại (Bestseller, Món mới) và cấu hình tuỳ chọn topping/đường/đá.',
     'Nguyễn Văn A', 52, null, '{"menu_count":45,"menu_label":"45 món ăn & đồ uống"}', null, null),
    (4, 'Hỗ trợ quán thiết lập voucher giảm giá đặc biệt dịp ra mắt (giảm 20% đơn từ 50k), cấp quyền truy cập app quản trị Giaodoan Merchant POS và tiến hành cấu hình máy in hóa đơn Sunmi.',
     null, null, 'Dự kiến xong: Hôm nay', '{"tech_owner":"Nguyễn Văn A","voucher":"WHISPERNEW"}',
     'Giúp Whisper Coffee chuẩn bị chiến dịch giảm giá 20% cho tuần khai trương và kết nối thành công máy in/POS tại quầy pha chế.',
     array['Hướng dẫn chủ quán vào mục CTKM trên ứng dụng Giaodoan Merchant.',
           'Chọn mẫu "Giảm 20% đơn từ 50k" hoặc thiết lập mã voucher độc quyền WHISPERNEW.',
           'Tải app Giaodoan Merchant POS lên tablet Sunmi của quán và đăng nhập tài khoản chính thức.',
           'Thực hiện in test 1 hóa đơn mẫu để kiểm tra kết nối Bluetooth hoặc mạng LAN nội bộ máy in nhiệt.']),
    (5, 'Tạo 1 đơn đặt hàng giả lập từ ứng dụng khách hàng Giaodoan, tài xế nhận đơn, in phiếu bếp và hoàn tất luồng thanh toán giao dịch mẫu trước khi chính thức Go-Live toàn hệ thống.',
     null, null, 'Kế hoạch: 3 ngày cuối của kỳ onboarding', '{"target_status":"Chính thức mở bán (Live)"}', null, null)
  ) as v(n, description, completed_by, hours, planned_label, meta, guide_goal, guide_checklist)
) d
where os.onboarding_id = d.onboarding_id and os.step_no = d.n;

insert into onboarding_tasks (step_id, title, done, sort_order)
select os.id, t.title, t.done, t.sort_order
from onboarding_steps os
join onboardings o on o.id = os.onboarding_id
join merchants m on m.id = o.merchant_id and m.code = 'MC-3926'
cross join (values
  ('Tạo voucher khai trương WHISPERNEW', true, 1),
  ('Đăng nhập app tablet Sunmi', true, 2),
  ('In test đơn thử nghiệm trên máy in LAN', false, 3),
  ('Xác nhận thông báo âm thanh chuông đơn', false, 4)
) as t(title, done, sort_order)
where os.step_no = 4;

-- ---------------------------------------------------------------------------
-- support tickets (8 rows of the list; TK-8841 is the detail screen)
-- ---------------------------------------------------------------------------
insert into support_tickets (code, merchant_id, branch_label, category, subject, body, priority, status, assignee_id,
                             sla_due_at, responded_at, status_note, created_at, updated_at, updated_by)
select v.code, m.id, v.branch_label, v.category, v.subject, v.body, v.priority, v.status, st.id,
       case when v.sla_min is null then null else now() + (v.sla_min || ' minutes')::interval end,
       case when v.resp_min_after is null then null else now() - (v.age_min || ' minutes')::interval + (v.resp_min_after || ' minutes')::interval end,
       v.status_note,
       now() - (v.age_min || ' minutes')::interval,
       now() - (v.upd_min || ' minutes')::interval,
       'Nguyễn Văn A'
from (values
  ('TK-8841', 'MC-3926', 'Chi nhánh 1 • Q.1, TP. Hồ Chí Minh', 'payment', 'Chưa nhận được tiền đối soát tuần 43',
   $b$Kính gửi đội ngũ hỗ trợ đối tác Giaodoan,

Cơ sở Whisper Coffee & Lounge (Chi nhánh Hải Châu, Đà Nẵng) đã gửi lệnh đối soát doanh thu chu kỳ tuần 43 (từ ngày 20/10 đến 26/10/2025) với tổng số tiền 48.250.000 VNĐ. Tuy nhiên đến hôm nay hệ thống ngân hàng liên kết MB Bank chưa ghi nhận lệnh chuyển khoản đối soát về số tài khoản cơ sở.

Nhờ ban quản trị kiểm tra lại trạng thái lệnh thanh toán và biên lai giao dịch từ cổng thanh toán tự động giúp quán để kịp thời thanh toán nguồn cung ứng thực phẩm cuối tháng. Xin chân thành cảm ơn.$b$,
   'high', 'processing', 'GD-NV082', 105, null::int, null, 180, 25),
  ('TK-8840', 'MC-3925', 'Trụ sở chính • Hải Châu, Đà Nẵng', 'onboarding', 'Hỏi về bước thiết lập menu',
   'Quán cần hướng dẫn tải menu 40 món và gắn ảnh cho từng món trên portal.', 'normal', 'resolved', 'GD-NV120', null, 25, 'Đã phản hồi', 240, 200),
  ('TK-8839', 'MC-3924', 'Tầng 12 Rooftop • Hoàn Kiếm, Hà Nội', 'login', 'Không đăng nhập được app Merchant POS',
   'Nhân viên thu ngân nhập đúng mật khẩu nhưng app báo "tài khoản bị khóa tạm thời".', 'high', 'new', 'GD-NV105', 190, null, null, 360, 360),
  ('TK-8838', 'MC-3923', 'Cơ sở 2 • TP. Bắc Ninh', 'store', 'Cập nhật giờ mở cửa cơ sở 2',
   'Quán xin đổi giờ mở cửa sang 06:00 - 22:00 nhưng hệ thống yêu cầu bổ sung giấy phép kinh doanh.', 'normal', 'waiting_merchant', 'GD-NV108', null, 40, 'Đợi bổ sung giấy phép KD', 420, 380),
  ('TK-8837', 'MC-3922', 'Trụ sở Huế • TP. Huế', 'feedback', 'Góp ý hiển thị tên món tiếng Việt có dấu',
   'Đề xuất app hiển thị tên món đầy đủ dấu trên phiếu in bếp.', 'low', 'resolved', 'GD-NV122', null, 30, 'Đã ghi nhận & phản hồi', 480, 440),
  ('TK-8836', 'MC-3921', 'Cơ sở Đinh Tiên Hoàng • Q.1, TP. HCM', 'payment', 'Đối soát tuần 42 lệch 3 đơn',
   'Số đơn trên báo cáo đối soát ít hơn hệ thống POS của quán 3 đơn.', 'high', 'new', 'GD-NV082', 45, null, null, 540, 540),
  ('TK-8835', 'MC-3920', 'Trần Phú • Q.5, TP. Hồ Chí Minh', 'other', 'Yêu cầu xuất hóa đơn VAT tháng 9',
   'Quán cần xuất lại hóa đơn VAT chiết khấu tháng 9 theo tên công ty mới.', 'normal', 'resolved', 'GD-NV121', null, 50, 'Đã phản hồi', 1740, 1690),
  ('TK-8834', 'MC-3916', 'Tây Hồ • Hà Nội', 'onboarding', 'Bổ sung hồ sơ pháp lý đại diện',
   'Ảnh CCCD đại diện bị mờ, cần chụp lại để hoàn tất xác minh.', 'normal', 'waiting_merchant', 'GD-NV082', null, 40, 'Đợi gửi lại ảnh CCCD đại diện', 1900, 1860)
) as v(code, mcode, branch_label, category, subject, body, priority, status, staff_code, sla_min, resp_min_after, status_note, age_min, upd_min)
join merchants m on m.code = v.mcode
left join staff st on st.code = v.staff_code;

insert into ticket_attachments (ticket_id, file_name, size_label, kind_label, kind, uploaded_by)
select t.id, v.file_name, v.size_label, v.kind_label, v.kind, 'merchant'
from (values
  ('TK-8841', 'Bang_ke_doanh_thu_t43.xlsx', '240 KB', 'Bảng kê Excel', 'xlsx'),
  ('TK-8841', 'Sao_ke_MBBank_2810.pdf', '1.2 MB', 'Tài liệu PDF', 'pdf'),
  ('TK-8838', 'Anh_chup_cua_hang_co_so_2.png', '860 KB', 'Hình ảnh', 'image')
) as v(tcode, file_name, size_label, kind_label, kind)
join support_tickets t on t.code = v.tcode;

insert into ticket_messages (code, ticket_id, handler_id, handler_name, handler_role, responder_name, content, channel, created_at)
select v.code, t.id, st.id, st.full_name, v.handler_role, st.full_name, v.content, v.channel, now() - (v.age_min || ' minutes')::interval
from (values
  ('PH-01', 'TK-8841', 'GD-NV082', 'Tài chính & Đối soát',
   'Đã tiếp nhận yêu cầu từ quán. Bộ phận Kế toán đang đối chiếu lại cổng kết nối MB Bank chi nhánh miền Trung. Dự kiến có phản hồi trong 60 phút.', 'app', 140),
  ('PH-02', 'TK-8841', 'GD-NV120', 'Trưởng nhóm Vận hành F&B',
   'Đã xác nhận lỗi gián đoạn từ cổng chuyển khoản tự động Napas247 lúc 14:00 hôm nay. Tiền đang trong hàng đợi xử lý bù tự động của cổng thanh toán.', 'zalo_sms', 70),
  ('PH-03', 'TK-8841', 'GD-NV082', 'Tài chính & Đối soát',
   'Thành công. Lệnh chuyển bù đã được đối tác ngân hàng giải ngân thành công lúc 16:55. Mã tham chiếu giao dịch FT2530188921. Đề nghị Merchant kiểm tra app banking và xác nhận lại với Giaodoan.', 'app', 25)
) as v(code, tcode, staff_code, handler_role, content, channel, age_min)
join support_tickets t on t.code = v.tcode
join staff st on st.code = v.staff_code;

insert into ticket_messages (ticket_id, handler_id, handler_name, handler_role, responder_name, content, channel, created_at)
select t.id, st.id, st.full_name, v.handler_role, st.full_name, v.content, v.channel, now() - (v.age_min || ' minutes')::interval
from (values
  ('TK-8840', 'GD-NV120', 'Trưởng nhóm Vận hành F&B', 'Đã gửi video hướng dẫn tải menu hàng loạt bằng file Excel qua Zalo OA của quán.', 'zalo_sms', 215),
  ('TK-8837', 'GD-NV122', 'Hỗ trợ Merchant', 'Cảm ơn góp ý của quán. Giaodoan đã ghi nhận và chuyển đội sản phẩm đánh giá cho bản cập nhật tới.', 'email', 450)
) as v(tcode, staff_code, handler_role, content, channel, age_min)
join support_tickets t on t.code = v.tcode
join staff st on st.code = v.staff_code;

insert into reply_templates (title, body, sort_order) values
  ('Xác nhận đã hoàn tất đối soát và gửi tiền bù',
   'Giaodoan xin thông báo lệnh đối soát của quán đã được xử lý hoàn tất. Khoản tiền bù đã được chuyển về tài khoản liên kết, quán vui lòng kiểm tra app ngân hàng và phản hồi nếu chưa nhận được.', 1),
  ('Yêu cầu quán cung cấp thêm ảnh sao kê ngân hàng',
   'Để tiếp tục xử lý yêu cầu, quán vui lòng gửi thêm ảnh sao kê ngân hàng (PDF/PNG) thể hiện giao dịch liên quan trong khoảng thời gian đối soát.', 2),
  ('Thông báo bảo trì cổng thanh toán tự động',
   'Cổng thanh toán tự động đang trong thời gian bảo trì. Các lệnh đối soát sẽ được xử lý bù ngay khi hệ thống hoạt động trở lại. Giaodoan xin lỗi vì sự bất tiện này.', 3);

-- ---------------------------------------------------------------------------
-- contact logs (LH-6842 ... LH-6837 + onboarding interaction history for Whisper)
-- ---------------------------------------------------------------------------
insert into contact_logs (code, merchant_id, staff_id, actor_name, channel, channel_label, contact_person, purpose, content, tags,
                          status, duration_seconds, has_recording, needs_callback, callback_at, occurred_at)
select v.code, m.id, st.id, v.actor_name, v.channel, v.channel_label, v.contact_person, v.purpose, v.content, v.tags,
       v.status, v.duration, v.has_rec, v.needs_cb,
       case when v.callback_days is null then null else now() + (v.callback_days || ' days')::interval end,
       now() - (v.age_min || ' minutes')::interval
from (values
  ('LH-6842', 'MC-3926', 'GD-NV082', null::text, 'voip', 'VoIP In-app', 'Anh Long (Chủ quán)', 'Tư vấn gia hạn gói',
   'Tư vấn nâng cấp từ Gói Bạc lên Gói Vàng Gold để nhận hỗ trợ chạy flash sale cuối tuần. Khách đồng ý xem báo giá và hẹn xác nhận trước thứ Sáu.',
   array['Upsell Gói Gold','Hẹn callback 31/10'], 'success', 275, true, true, 3, 15),
  ('LH-6841', 'MC-3925', 'GD-NV105', null, 'voip', 'VoIP In-app', 'Chị Thảo (Kế toán)', 'Xử lý sự cố POS / Đơn hàng',
   'Gọi kiểm tra tình trạng máy in POS Kiot sau khi cập nhật phiên bản mới. Quán báo máy đã in trơn tru, không còn lỗi ngắt kết nối.',
   array['Hỗ trợ kỹ thuật','Firmware v2.4'], 'success', 138, true, false, null::int, 60),
  ('LH-6840', 'MC-3924', 'GD-NV108', null, 'voip', 'VoIP In-app', 'Anh Dũng (Quản lý)', 'Khảo sát định kỳ quý',
   'Khách bận tiếp đoàn khách đông, vừa nghe máy báo bận và cúp ngang, chưa kịp trao đổi thông tin khuyến mãi.',
   array['Khách đang bận','Gọi lại sau 15:00'], 'hung_up', 14, false, true, 0, 120),
  ('LH-6839', 'MC-3922', 'GD-NV112', null, 'zalo', 'Zalo OA + Call', 'Chị Hoa (Chủ hộ)', 'Hướng dẫn Onboarding & Menu',
   'Chuông đổ 4 hồi không ai nhấc máy, đã gửi tin nhắn Zalo ZNS tự động kèm link hướng dẫn thiết lập menu.',
   array['Tự động gửi Zalo ZNS','Cần gọi lại'], 'no_answer', 0, false, true, 1, 1000),
  ('LH-6838', 'MC-3921', 'GD-NV082', null, 'meet', 'Google Meet', 'Anh Tuấn (Chủ chuỗi 3 CN)', 'Hướng dẫn Onboarding & Menu',
   'Liên hệ nhắc lịch đào tạo nhân viên thu ngân về quy trình nhận đơn Delivery vào 14h ngày mai qua Google Meet. Quán đã xác nhận 5 nhân sự tham gia.',
   array['Training nghiệp vụ','Đã gửi lịch Meet'], 'success', 765, false, false, null, 1180),
  ('LH-6837', 'MC-3914', 'GD-NV108', null, 'voip', 'VoIP In-app', 'Chị Mai (Kế toán trưởng)', 'Tư vấn gia hạn gói',
   'Hỗ trợ thủ tục gia hạn hợp đồng năm 2026 và xuất hóa đơn điện tử VAT chiết khấu doanh thu tháng 9. Đã gửi link ký số qua mail đối tác.',
   array['Hợp đồng 2026','Hóa đơn VAT'], 'success', 372, true, false, null, 1450)
) as v(code, mcode, staff_code, actor_name, channel, channel_label, contact_person, purpose, content, tags,
       status, duration, has_rec, needs_cb, callback_days, age_min)
join merchants m on m.code = v.mcode
left join staff st on st.code = v.staff_code;

-- Whisper interaction history (onboarding detail "Lich su tuong tac gan nhat"); codes come from the sequence
insert into contact_logs (merchant_id, staff_id, actor_name, channel, channel_label, contact_person, purpose, content, tags,
                          status, duration_seconds, occurred_at)
select m.id, st.id, v.actor_name, v.channel, v.channel_label, v.contact_person, v.purpose, v.content, v.tags,
       'success', v.duration, now() - (v.age_min || ' minutes')::interval
from (values
  ('GD-NV082', null::text, 'voip', 'VoIP In-app', 'Trần Minh Long (Chủ cơ sở)', 'Hướng dẫn Onboarding & Menu', 'Cuộc gọi xác nhận menu 45 món', array['Onboarding']::text[], 320, 1500),
  (null, 'Hệ thống tự động', 'zalo', 'Zalo ZNS', 'Trần Minh Long (Chủ cơ sở)', 'Hướng dẫn Onboarding & Menu', 'Gửi mã đăng nhập app POS qua tin nhắn Zalo ZNS', array['Onboarding','Zalo ZNS']::text[], 0, 2800),
  ('GD-NV082', null, 'note', 'Ghi chú khảo sát', 'Nguyễn Thu Nga (Cửa hàng trưởng)', 'Khảo sát định kỳ quý', 'Ghi chú: Quán ưu tiên chạy CTKM tặng kèm bánh quy bơ', array['Khảo sát']::text[], 0, 3900)
) as v(staff_code, actor_name, channel, channel_label, contact_person, purpose, content, tags, duration, age_min)
join merchants m on m.code = 'MC-3926'
left join staff st on st.code = v.staff_code;

-- ---------------------------------------------------------------------------
-- churn risks (68 in the design; 8 rows here)
-- ---------------------------------------------------------------------------
insert into churn_risks (merchant_id, risk_type, risk_level, expires_on, inactive_days, alert_text, handled, handled_at, assignee_id, note, detected_at)
select m.id, v.risk_type, v.risk_level, current_date + v.expires_days, v.inactive_days, v.alert_text, v.handled,
       case when v.handled then now() - interval '1 day' else null end, st.id, v.note, now() - (v.detected_days || ' days')::interval
from (values
  ('MC-3926', 'expiring',     'critical', 3,   null::int, null::text,                       false, 'GD-NV082', null::text, 2),
  ('MC-3925', 'order_gap',    'high',     150, 10,        '10 ngày không phát sinh đơn',    false, 'GD-NV108', null, 3),
  ('MC-3924', 'expiring',     'critical', 5,   null,      null,                             false, 'GD-NV108', null, 2),
  ('MC-3923', 'app_inactive', 'medium',   90,  7,         '7 ngày chưa vào app',            false, 'GD-NV112', null, 1),
  ('MC-3922', 'expiring',     'critical', 2,   null,      null,                             true,  'GD-NV112', 'Đã gọi hẹn tái ký trong tuần', 4),
  ('MC-3921', 'order_gap',    'high',     180, 14,        '14 ngày không phát sinh đơn',    false, 'GD-NV122', null, 5),
  ('MC-3920', 'expiring',     'critical', 4,   null,      null,                             false, 'GD-NV108', null, 2),
  ('MC-3919', 'app_inactive', 'medium',   120, 8,         '8 ngày chưa vào app',            true,  'GD-NV082', 'Đã nhắc đăng nhập qua Zalo', 3)
) as v(mcode, risk_type, risk_level, expires_days, inactive_days, alert_text, handled, staff_code, note, detected_days)
join merchants m on m.code = v.mcode
left join staff st on st.code = v.staff_code;

-- ---------------------------------------------------------------------------
-- activity log for Whisper (10 rows of the design)
-- ---------------------------------------------------------------------------
insert into activity_logs (merchant_id, occurred_at, action_type, action_label, subtitle, icon, category, details, old_value, new_value, extra,
                           actor_type, actor_name, actor_role, device, ip, status)
select m.id, now() - (v.age_min || ' minutes')::interval, v.action_type, v.action_label, v.subtitle, v.icon, v.category,
       v.details, v.old_value, v.new_value, v.extra::jsonb, v.actor_type, v.actor_name, v.actor_role, v.device, v.ip, v.status
from merchants m
cross join (values
  (10, 'pause_orders', 'Ngưng nhận đơn hôm nay', 'Vận hành quán', 'pause_circle', 'config',
   'Chủ quán chủ động tắt nhận đơn trên hệ thống. Lý do: Quá tải giờ cao điểm & hết đá viên',
   'Đang mở bán', 'Tạm ngưng', '{"reason":"Quá tải giờ cao điểm & hết đá viên"}',
   'owner', 'Nguyễn Văn Long', 'Chủ quán', 'Giaodoan Partner App v3.2.1', 'IP: 113.161.84.120 (iPhone 15 Pro)', 'success'),
  (23, 'confirm_order', 'Xác nhận đơn hàng', 'Xử lý giao dịch', 'receipt_long', 'orders',
   'Nhận đơn #DH-9014 • 3 món: 02 Cà phê muối, 01 Trà đào cam sả. Tổng giá trị thanh toán: 185.000đ (Thanh toán Ví MoMo)',
   null, null, '{"order_code":"DH-9014","amount_vnd":185000,"payment":"Ví MoMo","items":"02 Cà phê muối, 01 Trà đào cam sả"}',
   'cashier', 'Thu ngân - Ca Sáng', null, 'Sunmi V2 PRO POS', 'IP: 192.168.1.45 (Local Wifi)', 'success'),
  (65, 'update_store', 'Cập nhật thông tin quán', 'Hồ sơ hiển thị', 'edit_calendar', 'config',
   'Thay đổi khung giờ phục vụ phục vụ khách mùa thu đông.',
   '06:30 - 22:30', '07:00 - 23:00', '{}',
   'owner', 'Nguyễn Văn Long', 'Chủ quán', 'Web Merchant Portal / Chrome 120', 'IP: 14.162.144.89 (MacOS)', 'success'),
  (185, 'update_menu', 'Cập nhật menu & giá món', 'Thực đơn', 'restaurant_menu', 'config',
   'Điều chỉnh giá bán món: Cà phê muối xứ Huế (Size M)',
   '35.000đ', '39.000đ', '{"item":"Cà phê muối xứ Huế (Size M)","change_pct":11.4}',
   'owner', 'Nguyễn Văn Long', 'Chủ quán', 'Web Merchant Portal / Safari 17', 'IP: 14.162.144.89', 'success'),
  (255, 'cancel_order', 'Hủy đơn hàng', 'Hủy giao dịch', 'cancel', 'orders',
   'Hủy đơn hàng #DH-9002 (Trị giá 92.000đ). Lý do: Khách hàng gọi báo đặt nhầm địa chỉ nhận tại Hội An. Hoàn tiền 100%.',
   null, null, '{"order_code":"DH-9002","amount_vnd":92000,"reason":"Khách đặt nhầm địa chỉ nhận tại Hội An. Hoàn tiền 100%"}',
   'cashier', 'Trần Thị Bích', 'Thu ngân', 'POS Terminal 01', 'IP: 192.168.1.45', 'cancelled'),
  (330, 'create_promo', 'Tạo mã khuyến mãi', 'Marketing CTKM', 'percent', 'config',
   'Kích hoạt voucher WHISPER10. Giảm 10% tối đa 30.000đ cho đơn từ 120.000đ. Giới hạn 200 lượt áp dụng.',
   null, null, '{"voucher_code":"WHISPER10"}',
   'owner', 'Nguyễn Văn Long', 'Chủ quán', 'Web Merchant Portal', 'IP: 14.162.144.89', 'success'),
  (440, 'resume_orders', 'Mở nhận đơn trở lại', 'Bắt đầu ngày mới', 'play_circle', 'config',
   'Cửa hàng mở cửa đón khách và đồng bộ bật online trên toàn bộ ứng dụng Giaodoan Delivery. Sẵn sàng nhận đơn tự động và giao qua đối tác tài xế.',
   null, null, '{}',
   'cashier', 'Lê Hải Anh', 'Quản lý ca', 'Giaodoan Partner App v3.2.1', 'IP: 113.161.84.11', 'success'),
  (450, 'login_failed', 'Đăng nhập thất bại', 'An ninh tài khoản', 'lock_reset', 'security',
   'Nhập sai mật khẩu liên tiếp 3 lần từ địa chỉ IP lạ ngoài khu vực đăng ký thường trú. Hệ thống kích hoạt khóa tạm thời 15 phút và gửi mã OTP xác thực qua SMS.',
   null, null, '{}',
   'guest', 'Không xác định (Guest)', null, 'Firefox 122 on Windows 11', 'IP: 42.118.23.190 (Hà Nội)', 'failed'),
  (1000, 'pos_sync', 'Đồng bộ đơn POS', 'Kết nối phần cứng', 'sync_problem', 'security',
   'Mất kết nối API máy in hóa đơn quầy bar: ERR_PRINTER_TIMEOUT_504. Hệ thống đã tự động thử lại lần 2 và in bù vé đơn #DH-8991 thành công.',
   null, null, '{"error_code":"ERR_PRINTER_TIMEOUT_504","order_code":"DH-8991"}',
   'system', 'Hệ thống POS Tự động', null, 'Giaodoan Connector Agent v1.4', 'LAN ID: 00:1A:2B:3C:4D:5E', 'warning'),
  (1180, 'update_document', 'Cập nhật chứng từ ATVSTP', 'Tuân thủ pháp lý', 'verified_user', 'config',
   'Chuyên viên CSKH Giaodoan phê duyệt bổ sung Giấy chứng nhận An toàn thực phẩm mới (Số hiệu: 234/2025/ATTP-ĐN). Gia hạn hiệu lực gian hàng trực tuyến tới 31/12/2026.',
   null, null, '{"certificate":"234/2025/ATTP-ĐN"}',
   'support', 'Phạm Thu Hà', 'CSKH Admin', 'Giaodoan Admin Internal', 'VPN Secure Token #GD-892', 'success')
) as v(age_min, action_type, action_label, subtitle, icon, category, details, old_value, new_value, extra,
       actor_type, actor_name, actor_role, device, ip, status)
where m.code = 'MC-3926';

-- ---------------------------------------------------------------------------
-- FAQ (FAQ-101 ... FAQ-106 from the design + 4 extras for filters)
-- ---------------------------------------------------------------------------
insert into faqs (code, category, question, answer, icon, view_count, is_visible, audience, updated_by_id, updated_at)
select v.code, v.category, v.question, v.answer, v.icon, v.views, v.visible, v.audience, st.id, now() - (v.age_min || ' minutes')::interval
from (values
  ('FAQ-101', 'payout', 'Làm thế nào để đối soát doanh thu và rút tiền về tài khoản ngân hàng của quán?',
   'Doanh thu đơn hàng sẽ được đối soát tự động theo chu kỳ Thứ Hai hàng tuần. Số tiền hợp lệ sau khi trừ phí chiết khấu sàn sẽ tự động giải ngân vào tài khoản MB Bank liên kết trong vòng 24h làm việc.',
   'payments', 4120, true, 'all', 'GD-NV082', 120),
  ('FAQ-102', 'operations', 'Quán bị mất kết nối máy in hóa đơn POS hoặc không nhận đơn mới thì xử lý ra sao?',
   'Hãy kiểm tra kết nối WiFi/LAN tại quầy thu ngân. Khởi động lại ứng dụng Giaodoan Merchant POS. Nếu đèn nguồn máy in nháy đỏ, kiểm tra cuộn giấy nhiệt hoặc gọi ngay hotline kỹ thuật 24/7 để được hỗ trợ từ xa.',
   'print', 3850, true, 'all', 'GD-NV120', 1400),
  ('FAQ-103', 'policy', 'Quy trình gia hạn gói dịch vụ Gói Vàng/Kim Cương khi sắp hết hạn hợp đồng?',
   'Merchant vào mục ''Gói Dịch Vụ'' trên app hoặc portal, chọn ''Gia hạn ngay'' trước 15 ngày để giữ nguyên ưu đãi chiết khấu. Nhân sự AM phụ trách sẽ liên hệ hỗ trợ ký phụ lục hợp đồng điện tử.',
   'workspace_premium', 2940, true, 'chain', 'GD-NV121', 2900),
  ('FAQ-104', 'operations', 'Làm sao để thay đổi giờ mở cửa hoặc tạm đóng quán đột xuất trong ngày lễ?',
   'Vào mục Cấu hình cửa hàng > Thiết lập lịch biểu hoạt động > Chọn ''Tạm đóng cửa'' và thiết lập thời gian tự động mở lại. Hệ thống sẽ ngừng phân phối đơn mới cho shipper trong khung giờ này.',
   'schedule', 2610, true, 'all', 'GD-NV122', 4300),
  ('FAQ-105', 'promotion', 'Hướng dẫn đăng ký chương trình khuyến mãi giảm 20% - 50% cho quán mới onboard?',
   'Truy cập phân hệ CTKM > Bấm ''Tạo khuyến mãi mới'' > Chọn gói tài trợ đồng hành từ Giaodoan. Sau khi gửi duyệt trong 2 giờ làm việc, chương trình sẽ hiển thị nổi bật trên banner app khách hàng.',
   'loyalty', 2180, true, 'new', 'GD-NV120', 5700),
  ('FAQ-106', 'account', 'Quên mật khẩu đăng nhập tài khoản Merchant Portal hoặc bị khóa tài khoản do nhập sai?',
   'Chọn ''Quên mật khẩu'' tại màn hình đăng nhập, nhập SĐT chủ quán để nhận mã OTP qua SMS. Trường hợp bị khóa an toàn, liên hệ hotline hỗ trợ viên để xác minh giấy phép ĐKKD hoặc CCCD đại diện.',
   'lock_reset', 1950, true, 'all', 'GD-NV082', 8100),
  ('FAQ-107', 'policy', 'Phí chiết khấu sàn được tính như thế nào theo từng gói dịch vụ?',
   'Gói Bạc 18%, Gói Vàng 15%, Gói Kim Cương 12% trên giá trị đơn hoàn tất, chưa bao gồm các khoản trợ giá từ chương trình khuyến mãi đồng tài trợ.',
   'percent', 1620, true, 'all', 'GD-NV121', 11500),
  ('FAQ-108', 'payout', 'Hướng dẫn xuất hóa đơn VAT chiết khấu doanh thu hàng tháng?',
   'Vào mục Đối soát > Hóa đơn, chọn kỳ cần xuất và bấm ''Yêu cầu xuất VAT''. Hóa đơn điện tử được gửi tới email nhận hóa đơn đã đăng ký trong 2 ngày làm việc.',
   'receipt_long', 1380, true, 'all', 'GD-NV082', 14400),
  ('FAQ-109', 'account', 'Cách thêm nhân viên thu ngân và phân quyền trên Merchant POS?',
   'Chủ quán đăng nhập portal > Quản lý nhân sự > Thêm nhân viên, nhập SĐT và chọn vai trò (Thu ngân, Quản lý ca). Nhân viên nhận mã kích hoạt qua SMS.',
   'manage_accounts', 980, true, 'new', 'GD-NV122', 20000),
  ('FAQ-110', 'promotion', 'Quy định hoàn tiền voucher khi đơn hàng bị hủy?',
   'Voucher sẽ được hoàn lại vào ví khách trong vòng 24h nếu đơn bị hủy trước khi quán xác nhận. Trường hợp quán hủy sau khi xác nhận, chi phí trợ giá do quán chịu.',
   'redeem', 540, false, 'chain', 'GD-NV120', 26000)
) as v(code, category, question, answer, icon, views, visible, audience, staff_code, age_min)
left join staff st on st.code = v.staff_code;

-- ---------------------------------------------------------------------------
-- promotions (6 from the design + 2 ended)
-- ---------------------------------------------------------------------------
insert into promotions (code, name, description, promo_type, discount_label, icon, sponsor, participants, start_date, end_date,
                        status, is_active, budget_vnd, spent_vnd, revenue_vnd, region, audience, terms)
values
  ('KM-FNB-2025', 'Đại Tiệc Món Ngon - Giảm 30% Tối Đa 50K', 'Áp dụng toàn bộ menu đồ ăn chính, tối thiểu 2 món',
   'percent', 'Giảm 30% (Max 50K)', 'percent', 'giaodoan_100', 315, current_date - 18, current_date + 12, 'running', true,
   120000000, 84000000, 1200000000, 'Toàn quốc', 'all', 'Đơn tối thiểu 2 món chính. Không áp dụng đồng thời với voucher khác.'),
  ('KM-FREESHIP-04', 'Miễn Phí Giao Hàng Toàn Thành Phố Đơn Từ 80K', 'Hỗ trợ chi phí vận chuyển trong bán kính 5km',
   'freeship', 'Freeship 15K', 'local_shipping', 'split_50_50', 420, current_date - 34, current_date + 27, 'running', true,
   90000000, 61000000, 850000000, 'Toàn quốc', 'all', 'Đơn từ 80.000đ trong bán kính 5km.'),
  ('KM-COMBO-LUNCH', 'Combo Trưa Văn Phòng Đồng Giá 39K', 'Khung giờ 11:00 - 13:30 các ngày trong tuần (T2 - T6)',
   'combo', 'Combo 39K', 'lunch_dining', 'giaodoan_70_mc_30', 185, current_date - 48, current_date + 12, 'running', true,
   60000000, 41000000, 600000000, 'TP. Hồ Chí Minh', 'top_tier', 'Áp dụng T2 - T6, 11:00 - 13:30.'),
  ('KM-WEEKEND-BOOST', 'Thứ 7 & CN Cuồng Nhiệt - Giảm 20% Toàn Menu', 'Áp dụng cho đơn hàng gia đình, tối thiểu 150.000đ',
   'percent', 'Giảm 20%', 'celebration', 'split_50_50', 98, current_date - 13, current_date + 10, 'running', true,
   40000000, 23000000, 350000000, 'Hà Nội', 'all', 'Đơn tối thiểu 150.000đ, cuối tuần.'),
  ('KM-NEWUSER-50K', 'Chào Bạn Mới - Tặng Voucher 50.000đ', 'Khách hàng lần đầu đặt hàng qua nền tảng Giaodoan',
   'voucher', 'Giảm 50K', 'redeem', 'giaodoan_100', 620, current_date - 300, current_date + 65, 'running', true,
   80000000, 52250000, 500000000, 'Toàn quốc', 'all', 'Chỉ áp dụng cho đơn đầu tiên của tài khoản mới.'),
  ('KM-TEA-COFFEE', 'Tuần Lễ Trà Sữa & Cà Phê - Đồng Tài Trợ 50%', 'Kích cầu mùa lễ hội ẩm thực đồ uống đồ tráng miệng',
   'bogo', 'Mua 1 Tặng 1', 'coffee', 'split_50_50', 56, current_date + 12, current_date + 19, 'upcoming', true,
   30000000, 0, 0, 'Đà Nẵng', 'list', 'Mua 1 đồ uống tặng 1 đồ uống cùng loại.'),
  ('KM-HALLOWEEN-25', 'Halloween Ẩm Thực - Giảm 25% Món Mới', 'Chương trình theo mùa dành cho món mới ra mắt',
   'percent', 'Giảm 25%', 'celebration', 'giaodoan_70_mc_30', 210, current_date - 40, current_date - 10, 'ended', false,
   20000000, 20000000, 200000000, 'TP. Hồ Chí Minh', 'all', 'Kết thúc sau 30 ngày.'),
  ('KM-FLASH-NOON', 'Flash Sale Giờ Vàng 11:00 - 13:00', 'Giảm giá sâu trong khung giờ cao điểm trưa',
   'flash_sale', 'Flash Sale giờ vàng', 'bolt', 'merchant_100', 75, current_date - 60, current_date - 30, 'ended', false,
   10000000, 10000000, 120000000, 'Hà Nội', 'top_tier', 'Mỗi merchant tối đa 50 suất/ngày.');

insert into promotion_merchants (promotion_id, merchant_id, orders_count, uplift_pct, revenue_gain_vnd)
select p.id, m.id, v.orders, v.uplift, v.gain
from (values
  ('KM-FNB-2025',      'MC-3926', 314, 46.0, 48200000),
  ('KM-FNB-2025',      'MC-3925', 215, 28.0, 31000000),
  ('KM-FNB-2025',      'MC-3924', 120, 18.0, 22400000),
  ('KM-FREESHIP-04',   'MC-3923', 280, 32.0, 39500000),
  ('KM-FREESHIP-04',   'MC-3922',  95, 12.0,  8600000),
  ('KM-FREESHIP-04',   'MC-3921', 150, 15.0, 12800000),
  ('KM-COMBO-LUNCH',   'MC-3920', 130, 20.0, 15400000),
  ('KM-COMBO-LUNCH',   'MC-3919',  70, 10.0,  6200000),
  ('KM-WEEKEND-BOOST', 'MC-3918',  88, 14.0,  9800000),
  ('KM-WEEKEND-BOOST', 'MC-3924',  60,  9.0,  7300000),
  ('KM-NEWUSER-50K',   'MC-3917', 210, 25.0, 26700000),
  ('KM-NEWUSER-50K',   'MC-3914',  90, 11.0,  8100000),
  ('KM-NEWUSER-50K',   'MC-3915',  40,  8.0,  3200000),
  ('KM-TEA-COFFEE',    'MC-3926',   0,  0.0,        0),
  ('KM-TEA-COFFEE',    'MC-3922',   0,  0.0,        0),
  ('KM-HALLOWEEN-25',  'MC-3917',  95, 16.0, 11200000),
  ('KM-FLASH-NOON',    'MC-3920',  60, 12.0,  7400000)
) as v(pcode, mcode, orders, uplift, gain)
join promotions p on p.code = v.pcode
join merchants m on m.code = v.mcode;

insert into promotion_budgets (region, quarter, limit_vnd, spent_vnd) values
  ('TP. Hồ Chí Minh',            'Q4/2025', 220000000, 176000000),
  ('Hà Nội',                      'Q4/2025', 150000000,  96000000),
  ('Đà Nẵng & Khu vực khác',      'Q4/2025',  80000000,  36250000);
