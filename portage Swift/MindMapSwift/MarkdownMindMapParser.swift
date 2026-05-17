import Foundation

enum MarkdownMindMapParser {
    private static let headingPattern = #"^(#{1,6})\s+(.+?)\s*#*\s*$"#

    static func parse(_ markdown: String) -> MindMapNode {
        var root = MindMapNode(title: "Mind Map")
        var stack: [(level: Int, id: UUID)] = [(level: 1, id: root.id)]
        var centralTitleApplied = false

        for rawLine in markdown.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }

            if let heading = parseHeading(line) {
                if heading.level == 1, !centralTitleApplied {
                    root.title = heading.title
                    centralTitleApplied = true
                    stack = [(level: 1, id: root.id)]
                    continue
                }

                while let last = stack.last, last.level >= heading.level {
                    stack.removeLast()
                }

                let parentID = stack.last?.id ?? root.id
                if let child = root.addChild(to: parentID, title: heading.title) {
                    stack.append((level: heading.level, id: child.id))
                }
                continue
            }

            if let bullet = parseBullet(line) {
                let parentID = stack.last?.id ?? root.id
                if let child = root.addChild(to: parentID, title: bullet) {
                    stack.append((level: (stack.last?.level ?? 1) + 1, id: child.id))
                }
            }
        }

        root.normalizeDepths()
        return root
    }

    private static func parseHeading(_ line: String) -> (level: Int, title: String)? {
        guard let regex = try? NSRegularExpression(pattern: headingPattern) else { return nil }
        let nsRange = NSRange(line.startIndex..<line.endIndex, in: line)
        guard let match = regex.firstMatch(in: line, range: nsRange),
              match.numberOfRanges == 3,
              let prefixRange = Range(match.range(at: 1), in: line),
              let titleRange = Range(match.range(at: 2), in: line) else {
            return nil
        }

        return (
            level: line[prefixRange].count,
            title: normalizeMarkdownText(String(line[titleRange]))
        )
    }

    private static func parseBullet(_ line: String) -> String? {
        let markers = ["- ", "* ", "+ "]
        for marker in markers where line.hasPrefix(marker) {
            return normalizeMarkdownText(String(line.dropFirst(marker.count)))
        }

        if let dotRange = line.range(of: #"^\d+\.\s+"#, options: .regularExpression) {
            return normalizeMarkdownText(String(line[dotRange.upperBound...]))
        }

        return nil
    }

    private static func normalizeMarkdownText(_ value: String) -> String {
        value
            .replacingOccurrences(of: #"^[-*+]\s+"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"`"#, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmedOrUntitled
    }
}
