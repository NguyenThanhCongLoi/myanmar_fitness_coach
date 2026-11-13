# Gói tham chiếu làm video – 13/11/2026

Mở `index.html` bằng Edge/Chrome để xem ảnh, lọc tại nhà/gym và tìm theo tên/ID. Ảnh nằm sẵn trong `images/`, không cần mạng. Link demo/nguồn ngoài cần mạng.

- Tổng 62 bài, chia 35 bài tại nhà và 27 bài cần thiết bị gym. Các bài tại nhà cũng dùng được ở gym; không tạo trùng ID. Nhóm tại nhà có thể cần tạ đơn, dây, ghế/bục chắc chắn – xem từng dòng.
- 44 bài có ảnh cục bộ (90 file gốc); 18 bài thiếu ảnh đúng động tác, được liệt kê trong `CAN_BO_SUNG_ANH.csv`. Không dùng ảnh của bài khác để lấp chỗ trống. Link ACE/NASM/AHA chỉ để tham khảo; không cấp quyền sao chép ảnh của họ.
- 26 bài chưa có demo; demo còn lại vẫn cần HLV kiểm tra tư thế trước khi dùng làm chuẩn quay.
- CSV có BOM UTF-8 để mở bằng Excel: `TAI_NHA.csv`, `PHONG_GYM.csv`, `TAT_CA_62_BAI.csv`.

## Mỗi bài cần sản xuất

1. `ID-loop.mp4`: 8–15 giây, 2–3 lần lặp chậm, toàn thân và điểm tiếp xúc sàn/dụng cụ luôn nằm trong khung. Tư thế giữ tĩnh quay đúng tư thế; không ép thêm chuyển động.
2. `ID-follow.mp4`: 30–60 giây để tập cùng. Bài một bên quay đủ trái/phải và có cue chuyển bên. Không tự nhân đôi số lần kê đơn.
3. `ID-poster.webp`: tư thế bắt đầu; thêm ảnh tư thế giữa/cuối và setup nếu là máy gym.
4. Khung dọc 9:16, 1080×1920, 24–30fps; MP4 H.264/yuv420p/faststart. Nếu có thể thêm bản ngang 16:9. Nền sáng, trang phục tương phản, máy cố định; không cắt chân/tay, không rung/zoom, không chữ hay đồng hồ đóng cứng vào hình.
5. Gym quay rõ chỉnh ghế, chốt tạ, tay nắm, vào/ra máy; động tác có tải được HLV duyệt. Âm nhạc/voice để file riêng; không đưa nhạc thương mại chưa có quyền vào video.

## Trước khi quay

Tên Việt là nhãn bàn giao; English name và ID là khóa đối chiếu. Hai ID cũ có lưu ý đặc biệt: `gym-lying-leg-curl` hiện là tư thế **ngồi**, còn `gym-lying-leg-curl-machine` là **nằm**; `curated-heel-walk` cần chốt đúng động tác nhón gót theo nhãn, không suy ra từ ID. Không thay thế biến thể âm thầm. Các hướng dẫn hiện có là bản nháp sản phẩm, không thay cho HLV duyệt kỹ thuật.

Nguồn/quyền từng file giữ nguyên tại `NGUON_VA_GIAY_PHEP.csv`; hash trong `MANIFEST.json` xác nhận ảnh được sao chép nguyên byte. Không xóa credit khi tái sử dụng file gốc có yêu cầu ghi công/share-alike. Video chủ sở hữu tự tạo cần quyền người biểu diễn, được HLV duyệt trước khi nhập manifest app. Chỉ dùng ảnh như tài liệu tham khảo, không mặc định ảnh là tư thế kỹ thuật đã được chứng nhận.
