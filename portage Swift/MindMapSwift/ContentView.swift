import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject private var model: MindMapAppModel
    @AppStorage("mindmap.isNightMode") private var isNightMode = true
    @State private var showingLibrary = false
    @State private var showingCreateMap = false
    @State private var showingImporter = false
    @State private var showingExporter = false
    @State private var showingCollapseLevels = false
    @State private var nodeCreationRequest: NodeCreationRequest?
    @State private var renameRequest: RenameRequest?

    private let markdownType = UTType.markdownMindMap

    var body: some View {
        NavigationStack {
            MindMapCanvasView(
                nodeCreationRequest: $nodeCreationRequest,
                renameRequest: $renameRequest
            )
            .environmentObject(model)
            .navigationTitle(model.activeMapName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button {
                        showingLibrary = true
                    } label: {
                        Label("Cartes", systemImage: "folder")
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            isNightMode.toggle()
                        } label: {
                            Label(isNightMode ? "Mode jour" : "Mode nuit", systemImage: isNightMode ? "sun.max" : "moon")
                        }

                        Button {
                            model.requestRecenter()
                        } label: {
                            Label("Recentrer la mind map", systemImage: "scope")
                        }

                        Button {
                            model.toggleLayoutMode()
                        } label: {
                            Label(model.layoutMode == .radial ? "Vue à droite" : "Vue horloge", systemImage: "arrow.triangle.2.circlepath")
                        }

                        Button {
                            showingCollapseLevels = true
                        } label: {
                            Label("Afficher les niveaux", systemImage: "rectangle.compress.vertical")
                        }
                        .disabled(model.visibleLevelChoices.isEmpty)
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                    }

                    Menu {
                        Button {
                            showingImporter = true
                        } label: {
                            Label("Importer Markdown", systemImage: "square.and.arrow.down")
                        }

                        Button {
                            showingExporter = true
                        } label: {
                            Label("Exporter Markdown", systemImage: "square.and.arrow.up")
                        }

                        Button {
                            showingCreateMap = true
                        } label: {
                            Label("Créer une carte", systemImage: "plus.square")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showingLibrary) {
                LibraryView()
                    .environmentObject(model)
            }
            .sheet(isPresented: $showingCreateMap) {
                CreateMapView { title in
                    model.createMap(title: title)
                    showingCreateMap = false
                }
            }
            .sheet(item: $nodeCreationRequest) { request in
                NodeCreationView(request: request) { title, nextAction in
                    commitNodeCreation(request: request, title: title, nextAction: nextAction)
                }
            }
            .sheet(item: $renameRequest) { request in
                RenameNodeView(request: request) { title in
                    model.renameNode(request.nodeID, title: title)
                    renameRequest = nil
                }
            }
            .fileImporter(
                isPresented: $showingImporter,
                allowedContentTypes: [markdownType, .plainText],
                allowsMultipleSelection: false
            ) { result in
                importMarkdown(result)
            }
            .fileExporter(
                isPresented: $showingExporter,
                document: MarkdownExportDocument(text: model.markdown),
                contentType: markdownType,
                defaultFilename: exportFileName
            ) { result in
                if case .failure = result {
                    model.errorMessage = "Le Markdown n'a pas pu être exporté."
                }
            }
            .alert("Action impossible", isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { model.errorMessage = nil }
            } message: {
                Text(model.errorMessage ?? "")
            }
            .confirmationDialog(
                "Afficher combien de niveaux ?",
                isPresented: $showingCollapseLevels,
                titleVisibility: .visible
            ) {
                ForEach(model.visibleLevelChoices, id: \.self) { levelCount in
                    Button("\(levelCount) \(levelCount == 1 ? "niveau" : "niveaux")") {
                        model.displayLevels(levelCount)
                    }
                }

                Button("Annuler", role: .cancel) {}
            } message: {
                Text("1 niveau affiche le centre et ses branches directes.")
            }
        }
        .preferredColorScheme(isNightMode ? .dark : .light)
    }

    private func commitNodeCreation(
        request: NodeCreationRequest,
        title: String,
        nextAction: NodeInsertAction?
    ) {
        guard let added = model.addNode(
            action: request.action,
            referenceID: request.referenceID,
            title: title
        ) else {
            nodeCreationRequest = nil
            return
        }

        nodeCreationRequest = nil

        guard let nextAction else { return }
        DispatchQueue.main.async {
            nodeCreationRequest = NodeCreationRequest(action: nextAction, referenceID: added.id)
        }
    }

    private func importMarkdown(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let access = url.startAccessingSecurityScopedResource()
            defer {
                if access { url.stopAccessingSecurityScopedResource() }
            }

            let markdown = try String(contentsOf: url, encoding: .utf8)
            let name = url.deletingPathExtension().lastPathComponent
            model.loadMarkdown(markdown, name: name)
            model.saveCurrentMap()
        } catch {
            model.errorMessage = "Le fichier Markdown n'a pas pu être importé."
        }
    }

    private var exportFileName: String {
        let clean = model.activeMapName
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? "mind-map" : clean
    }
}

struct MarkdownExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.markdownMindMap, .plainText] }
    static var writableContentTypes: [UTType] { [.markdownMindMap, .plainText] }

    var text: String

    init(text: String) {
        self.text = text
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents,
              let text = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.text = text
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}

private extension UTType {
    static let markdownMindMap = UTType(filenameExtension: "md") ?? .plainText
}
