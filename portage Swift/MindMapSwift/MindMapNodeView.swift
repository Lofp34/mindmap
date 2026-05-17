import SwiftUI

struct MindMapNodeView: View {
    let node: LayoutNode
    let selected: Bool
    let searchHit: Bool

    var body: some View {
        VStack(spacing: 2) {
            ForEach(Array(MindMapLayoutEngine.wrappedLines(
                for: node.title,
                maxCharacters: node.isRoot ? 30 : 28
            ).enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(node.isRoot ? .headline : .subheadline.weight(.semibold))
                    .foregroundStyle(node.isRoot ? Color.rootText : Color.primaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, node.isRoot ? 18 : 14)
        .frame(width: node.size.width, height: node.size.height)
        .background(background)
        .overlay(border)
        .shadow(color: Color.black.opacity(node.isRoot ? 0.22 : 0.14), radius: 12, x: 0, y: 8)
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(node.title)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var background: some ShapeStyle {
        if node.isRoot {
            return AnyShapeStyle(LinearGradient(
                colors: [Color.rootStart, Color.rootEnd],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ))
        }

        if node.depth == 1 {
            return AnyShapeStyle(Color.branchBackground)
        }

        return AnyShapeStyle(Color.nodeBackground)
    }

    private var border: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(borderColor, lineWidth: selected || searchHit ? 3 : 1.5)
    }

    private var borderColor: Color {
        if searchHit { return .yellow }
        if selected { return .accentTeal }
        if node.depth == 1 { return .accentTeal.opacity(0.6) }
        return .nodeBorder
    }
}

extension Color {
    static let appBackground = Color(red: 0.035, green: 0.054, blue: 0.087)
    static let canvasBackground = Color(red: 0.045, green: 0.068, blue: 0.112)
    static let nodeBackground = Color(red: 0.095, green: 0.095, blue: 0.155)
    static let branchBackground = Color(red: 0.055, green: 0.138, blue: 0.137)
    static let nodeBorder = Color(red: 0.42, green: 0.34, blue: 0.58)
    static let accentTeal = Color(red: 0.20, green: 0.84, blue: 0.70)
    static let link = Color(red: 0.46, green: 0.58, blue: 0.84)
    static let rootStart = Color(red: 0.52, green: 0.94, blue: 0.84)
    static let rootEnd = Color(red: 0.36, green: 0.54, blue: 0.94)
    static let rootText = Color(red: 0.02, green: 0.07, blue: 0.12)
    static let primaryText = Color(red: 0.91, green: 0.94, blue: 0.98)
}
