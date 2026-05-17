import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var model: MindMapAppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Modèles") {
                    ForEach(BuiltInTemplates.all) { template in
                        Button {
                            model.openTemplate(template)
                            dismiss()
                        } label: {
                            MapTemplateRow(title: template.name, subtitle: template.description)
                        }
                    }

                    ForEach(model.customTemplates) { map in
                        savedMapRow(map, archived: false)
                    }
                }

                Section("Cartes enregistrées") {
                    if model.activeMaps.isEmpty {
                        ContentUnavailableView("Aucune carte enregistrée", systemImage: "folder")
                    } else {
                        ForEach(model.activeMaps) { map in
                            savedMapRow(map, archived: false)
                        }
                    }
                }

                Section("Archive") {
                    if model.archivedMaps.isEmpty {
                        ContentUnavailableView("Archive vide", systemImage: "archivebox")
                    } else {
                        ForEach(model.archivedMaps) { map in
                            savedMapRow(map, archived: true)
                        }
                    }
                }
            }
            .navigationTitle("Cartes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }

    private func savedMapRow(_ map: SavedMindMap, archived: Bool) -> some View {
        HStack(spacing: 12) {
            Button {
                model.open(map)
                dismiss()
            } label: {
                MapTemplateRow(
                    title: map.name,
                    subtitle: archived ? "Archivée" : "Modifiée \(map.updatedAt.formatted(date: .abbreviated, time: .shortened))"
                )
            }
            .buttonStyle(.plain)

            Spacer()

            Menu {
                Button {
                    model.open(map)
                    dismiss()
                } label: {
                    Label("Ouvrir", systemImage: "arrow.right.circle")
                }

                if !archived {
                    Button {
                        model.archive(map)
                    } label: {
                        Label("Archiver", systemImage: "archivebox")
                    }
                }

                Button(role: .destructive) {
                    model.delete(map)
                } label: {
                    Label("Supprimer", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }
}

private struct MapTemplateRow: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
