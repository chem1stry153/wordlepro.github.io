import SwiftUI

@main
struct WordlesProPromoApp: App {
    var body: some Scene {
        WindowGroup {
            AppStorePromoView()
        }
    }
}

struct AppStorePromoView: View {
    @State private var showHero = false
    @State private var showTiles = false

    private let letters: [LetterState] = [
        .init(char: "W", color: Color(hex: 0x35D07F)),
        .init(char: "O", color: Color(hex: 0xF3C747)),
        .init(char: "R", color: Color(hex: 0xFF4F5F)),
        .init(char: "D", color: Color(hex: 0x35D07F)),
        .init(char: "L", color: Color(hex: 0xF3C747)),
        .init(char: "E", color: Color(hex: 0xFF4F5F)),
        .init(char: "S", color: Color(hex: 0x35D07F))
    ]

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x05060B), Color(hex: 0x0D1023), Color(hex: 0x04050A)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("WORDLES.PRO")
                        .font(.system(size: 34, weight: .semibold, design: .rounded))
                        .tracking(2)

                    Text("Wordle + WordlePro")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))

                    Text("10 次机会。Pro 模式只告诉你三类数量，不告诉你具体位置。")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(.white.opacity(0.82))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .opacity(showHero ? 1 : 0)
                .offset(y: showHero ? 0 : 14)
                .animation(.easeOut(duration: 0.8), value: showHero)

                HStack(spacing: 10) {
                    ForEach(Array(letters.enumerated()), id: \.offset) { index, item in
                        LetterTileView(letter: item.char, color: item.color)
                            .opacity(showTiles ? 1 : 0)
                            .offset(y: showTiles ? 0 : 12)
                            .animation(
                                .spring(response: 0.58, dampingFraction: 0.82)
                                .delay(Double(index) * 0.08),
                                value: showTiles
                            )
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    RuleRow(color: Color(hex: 0x35D07F), title: "绿色", detail: "字母正确且位置正确")
                    RuleRow(color: Color(hex: 0xF3C747), title: "黄色", detail: "字母存在但位置错误")
                    RuleRow(color: Color(hex: 0xFF4F5F), title: "红色", detail: "字母不在答案中")
                }

                Spacer()

                VStack(alignment: .leading, spacing: 6) {
                    Text("可直接用于 App Store 展示")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.55))
                    Text("wordles.pro")
                        .font(.system(size: 24, weight: .semibold, design: .rounded))
                }
            }
            .padding(24)
        }
        .onAppear {
            showHero = true
            showTiles = true
        }
    }
}

struct LetterTileView: View {
    let letter: String
    let color: Color
    @State private var pulse = false

    var body: some View {
        Text(letter)
            .font(.system(size: 22, weight: .semibold, design: .rounded))
            .frame(width: 48, height: 58)
            .background(color.opacity(pulse ? 0.36 : 0.2))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(color.opacity(0.75), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: color.opacity(pulse ? 0.55 : 0.25), radius: pulse ? 12 : 4)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
    }
}

struct RuleRow: View {
    let color: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
            Text(detail)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(.white.opacity(0.72))
        }
    }
}

struct LetterState {
    let char: String
    let color: Color
}

extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

#Preview {
    AppStorePromoView()
}
