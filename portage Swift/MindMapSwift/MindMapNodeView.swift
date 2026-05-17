import SwiftUI
import UIKit

struct MindMapNodeView: View {
    let node: LayoutNode
    let selected: Bool
    let searchHit: Bool
    let hasChildren: Bool
    let isExpanded: Bool

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
        .overlay(alignment: .topTrailing) {
            if hasChildren {
                childIndicator
            }
        }
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

    private var childIndicator: some View {
        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
            .font(.system(size: node.isRoot ? 12 : 10, weight: .bold))
            .foregroundStyle(Color.canvasBackground)
            .frame(width: node.isRoot ? 22 : 19, height: node.isRoot ? 22 : 19)
            .background(Color.accentTeal, in: Circle())
            .overlay(Circle().stroke(Color.canvasBackground, lineWidth: 2))
            .offset(x: node.isRoot ? 7 : 6, y: node.isRoot ? -7 : -6)
            .accessibilityHidden(true)
    }
}

extension Color {
    static var appBackground: Color {
        adaptive(
            light: rgb(247, 245, 242),
            dark: rgb(9, 14, 22)
        )
    }

    static var canvasBackground: Color {
        adaptive(
            light: rgb(255, 252, 248),
            dark: rgb(12, 18, 30)
        )
    }

    static var gridLine: Color {
        adaptive(
            light: rgb(31, 41, 51).withAlphaComponent(0.08),
            dark: rgb(255, 255, 255).withAlphaComponent(0.055)
        )
    }

    static var nodeBackground: Color {
        adaptive(
            light: rgb(255, 255, 255),
            dark: rgb(24, 24, 40)
        )
    }

    static var branchBackground: Color {
        adaptive(
            light: rgb(232, 246, 242),
            dark: rgb(14, 35, 35)
        )
    }

    static var nodeBorder: Color {
        adaptive(
            light: rgb(156, 146, 184),
            dark: rgb(107, 87, 148)
        )
    }

    static var accentTeal: Color {
        adaptive(
            light: rgb(15, 118, 110),
            dark: rgb(51, 214, 178)
        )
    }

    static var link: Color {
        adaptive(
            light: rgb(83, 108, 151),
            dark: rgb(117, 148, 214)
        )
    }

    static var rootStart: Color {
        adaptive(
            light: rgb(167, 241, 219),
            dark: rgb(133, 240, 214)
        )
    }

    static var rootEnd: Color {
        adaptive(
            light: rgb(139, 171, 244),
            dark: rgb(92, 138, 240)
        )
    }

    static var rootText: Color {
        adaptive(
            light: rgb(16, 32, 46),
            dark: rgb(5, 16, 30)
        )
    }

    static var primaryText: Color {
        adaptive(
            light: rgb(31, 41, 51),
            dark: rgb(232, 238, 247)
        )
    }

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }

    private static func rgb(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> UIColor {
        UIColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: 1)
    }
}
