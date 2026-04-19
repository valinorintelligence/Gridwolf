{{/* vim: set filetype=mustache: */}}
{{- define "gridwolf.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gridwolf.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "gridwolf.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gridwolf.labels" -}}
helm.sh/chart: {{ include "gridwolf.chart" . }}
{{ include "gridwolf.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: gridwolf
{{- end -}}

{{- define "gridwolf.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gridwolf.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "gridwolf.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "gridwolf.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Backend image */}}
{{- define "gridwolf.backend.image" -}}
{{- $repo := default (printf "%s/backend" .Values.image.repository) .Values.backend.image.repository -}}
{{- $tag := default .Values.image.tag .Values.backend.image.tag -}}
{{- printf "%s/%s:%s" .Values.image.registry $repo $tag -}}
{{- end -}}

{{/* Frontend image */}}
{{- define "gridwolf.frontend.image" -}}
{{- $repo := default (printf "%s/frontend" .Values.image.repository) .Values.frontend.image.repository -}}
{{- $tag := default .Values.image.tag .Values.frontend.image.tag -}}
{{- printf "%s/%s:%s" .Values.image.registry $repo $tag -}}
{{- end -}}

{{/* Secret name used by workloads */}}
{{- define "gridwolf.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- include "gridwolf.fullname" . -}}
{{- end -}}
{{- end -}}

{{/* Database URL */}}
{{- define "gridwolf.databaseUrl" -}}
{{- if .Values.postgresql.host -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:$(POSTGRES_PASSWORD)@{{ .Values.postgresql.host }}:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- else if .Values.postgresql.enabled -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:$(POSTGRES_PASSWORD)@{{ include "gridwolf.fullname" . }}-postgresql:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- else -}}
sqlite+aiosqlite:////data/gridwolf.db
{{- end -}}
{{- end -}}

{{/* Redis URL */}}
{{- define "gridwolf.redisUrl" -}}
{{- if .Values.redis.host -}}
redis://{{ .Values.redis.host }}:{{ .Values.redis.port }}/0
{{- else if .Values.redis.enabled -}}
redis://{{ include "gridwolf.fullname" . }}-redis:{{ .Values.redis.port }}/0
{{- else -}}
redis://localhost:6379/0
{{- end -}}
{{- end -}}
