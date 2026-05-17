import SwiftUI

struct MindMapCanvasView: View {
    @EnvironmentObject private var model: MindMapAppModel
    @Binding var nodeCreationRequest: NodeCreationRequest?
    @Binding var renameRequest: RenameRequest?

    @State private var scale: CGFloat = 1
    @State private var baseScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var baseOffset: CGSize = .zero
    @State private var didInitialFit = false
    @State private var pasteTargetID: UUID?

    var body: some View {
        GeometryReader { proxy in
            let viewport = proxy.size
            let layout = MindMapLayoutEngine.layout(
                root: model.visibleRoot,
                mode: model.layoutMode,
                viewport: CGSize(width: max(900, viewport.width * 1.6), height: max(700, viewport.height * 1.5))
            )

            ZStack {
                backgroundGrid

                Canvas { context, _ in
                    drawLinks(layout, context: &context)
                }
                .allowsHitTesting(false)

                ForEach(layout.nodes) { node in
                    MindMapNodeView(
                        node: node,
                        selected: model.selectedNodeID == node.id,
                        searchHit: false,
                        hasChildren: model.hasChildren(node.id),
                        isExpanded: model.isExpanded(node.id)
                    )
                    .position(transform(node.position))
                    .onTapGesture {
                        if model.cutNodeID != nil {
                            if model.canPasteCutNode(on: node.id) {
                                pasteTargetID = node.id
                            } else {
                                model.errorMessage = "Impossible de coller ce nœud ici."
                            }
                            return
                        }

                        model.selectAndToggle(node.id)
                        center(on: node.id, layout: layout, viewport: viewport)
                    }
                    .contextMenu {
                        Button {
                            nodeCreationRequest = NodeCreationRequest(action: .child, referenceID: node.id)
                        } label: {
                            Label("Ajouter un enfant", systemImage: "plus")
                        }

                        Button {
                            nodeCreationRequest = NodeCreationRequest(action: .sibling, referenceID: node.id)
                        } label: {
                            Label("Ajouter un frère", systemImage: "plus.rectangle.on.rectangle")
                        }
                        .disabled(node.isRoot)

                        Button {
                            renameRequest = RenameRequest(nodeID: node.id, currentTitle: node.title)
                        } label: {
                            Label("Renommer", systemImage: "pencil")
                        }

                        Button {
                            model.cutNode(node.id)
                        } label: {
                            Label("Couper", systemImage: "scissors")
                        }
                        .disabled(node.isRoot)

                        Button(role: .destructive) {
                            model.selectedNodeID = node.id
                            model.deleteSelectedNode()
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                        .disabled(node.isRoot)
                    }
                }

            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.horizontal, 10)
            .padding(.bottom, 10)
            .gesture(panGesture)
            .simultaneousGesture(zoomGesture)
            .onAppear {
                guard !didInitialFit else { return }
                didInitialFit = true
                fit(layout: layout, viewport: viewport)
            }
            .onChange(of: model.layoutMode) { _, _ in
                fit(layout: layout, viewport: viewport)
            }
            .onChange(of: model.recenterRequestID) { _, _ in
                center(on: model.root.id, layout: layout, viewport: viewport)
            }
            .confirmationDialog(
                pasteDialogTitle,
                isPresented: pasteDialogBinding,
                titleVisibility: .visible
            ) {
                Button("Coller ici") {
                    if let pasteTargetID {
                        _ = model.pasteCutNode(on: pasteTargetID)
                    }
                    pasteTargetID = nil
                }

                Button("Annuler", role: .cancel) {
                    model.cancelCutNode()
                    pasteTargetID = nil
                }
            } message: {
                Text("Le nœud coupé et tous ses enfants seront déplacés sous cette bulle.")
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
    }

    private var pasteDialogBinding: Binding<Bool> {
        Binding(
            get: { pasteTargetID != nil },
            set: { isPresented in
                if !isPresented { pasteTargetID = nil }
            }
        )
    }

    private var pasteDialogTitle: String {
        guard let title = model.cutNodeTitle else { return "Coller le nœud ?" }
        return "Coller « \(title) » ici ?"
    }

    private var backgroundGrid: some View {
        Canvas { context, size in
            let spacing: CGFloat = 36
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += spacing
            }
            context.stroke(path, with: .color(.gridLine), lineWidth: 1)
        }
        .background(Color.canvasBackground)
    }

    private func drawLinks(_ layout: MindMapLayoutResult, context: inout GraphicsContext) {
        let byID = layout.nodeByID
        for link in layout.links {
            guard let source = byID[link.source], let target = byID[link.target] else { continue }
            let start = transform(source.position)
            let end = transform(target.position)
            let midX = (start.x + end.x) / 2
            var path = Path()
            path.move(to: start)
            path.addCurve(
                to: end,
                control1: CGPoint(x: midX, y: start.y),
                control2: CGPoint(x: midX, y: end.y)
            )
            context.stroke(path, with: .color(Color.link.opacity(0.74)), lineWidth: max(1.2, scale * 1.8))
        }
    }

    private var panGesture: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                offset = CGSize(
                    width: baseOffset.width + value.translation.width,
                    height: baseOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                baseOffset = offset
            }
    }

    private var zoomGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let nextScale = clamp(baseScale * value.magnification)
                scale = nextScale
                offset = anchoredOffset(
                    anchor: value.startLocation,
                    startScale: baseScale,
                    nextScale: nextScale,
                    startOffset: baseOffset
                )
            }
            .onEnded { _ in
                baseScale = scale
                baseOffset = offset
            }
    }

    private func transform(_ point: CGPoint) -> CGPoint {
        CGPoint(x: point.x * scale + offset.width, y: point.y * scale + offset.height)
    }

    private func fit(layout: MindMapLayoutResult, viewport: CGSize) {
        guard let rect = boundingRect(layout.nodes) else { return }
        let padding: CGFloat = 68
        let fittedScale = clamp(min(
            (viewport.width - padding) / max(1, rect.width),
            (viewport.height - padding) / max(1, rect.height)
        ))
        scale = fittedScale
        baseScale = fittedScale
        let center = CGPoint(x: rect.midX, y: rect.midY)
        offset = CGSize(
            width: viewport.width / 2 - center.x * fittedScale,
            height: viewport.height / 2 - center.y * fittedScale
        )
        baseOffset = offset
    }

    private func center(on id: UUID, layout: MindMapLayoutResult, viewport: CGSize) {
        guard let node = layout.nodeByID[id] else { return }
        offset = CGSize(
            width: viewport.width / 2 - node.position.x * scale,
            height: viewport.height / 2 - node.position.y * scale
        )
        baseOffset = offset
    }

    private func setScale(_ next: CGFloat, viewport: CGSize) {
        let oldScale = scale
        let newScale = clamp(next)
        let center = CGPoint(x: viewport.width / 2, y: viewport.height / 2)
        let contentCenter = CGPoint(
            x: (center.x - offset.width) / max(oldScale, 0.01),
            y: (center.y - offset.height) / max(oldScale, 0.01)
        )
        scale = newScale
        baseScale = newScale
        offset = CGSize(
            width: center.x - contentCenter.x * newScale,
            height: center.y - contentCenter.y * newScale
        )
        baseOffset = offset
    }

    private func anchoredOffset(
        anchor: CGPoint,
        startScale: CGFloat,
        nextScale: CGFloat,
        startOffset: CGSize
    ) -> CGSize {
        let contentAnchor = CGPoint(
            x: (anchor.x - startOffset.width) / max(startScale, 0.01),
            y: (anchor.y - startOffset.height) / max(startScale, 0.01)
        )
        return CGSize(
            width: anchor.x - contentAnchor.x * nextScale,
            height: anchor.y - contentAnchor.y * nextScale
        )
    }

    private func clamp(_ value: CGFloat) -> CGFloat {
        min(4.0, max(0.12, value))
    }

    private func boundingRect(_ nodes: [LayoutNode]) -> CGRect? {
        guard let first = nodes.first else { return nil }
        return nodes.dropFirst().reduce(first.rect) { $0.union($1.rect) }
    }
}
