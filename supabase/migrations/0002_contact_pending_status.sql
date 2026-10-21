-- "Chờ gửi": reminders/campaigns that were logged but still have to be sent manually (Zalo/SMS).
alter table contact_logs drop constraint if exists contact_logs_status_check;
alter table contact_logs add constraint contact_logs_status_check check (status in ('success','no_answer','hung_up','pending'));
