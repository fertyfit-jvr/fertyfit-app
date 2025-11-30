import Foundation
import Capacitor
import HealthKit

/**
 * HealthKit Plugin for Capacitor
 * Provides access to Apple HealthKit data
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {
    private let healthStore = HKHealthStore()
    
    /**
     * Check if HealthKit is available on this device
     */
    @objc func isAvailable(_ call: CAPPluginCall) {
        let available = HKHealthStore.isHealthDataAvailable()
        call.resolve([
            "available": available
        ])
    }
    
    /**
     * Request authorization to read health data
     */
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit no está disponible en este dispositivo")
            return
        }
        
        guard let readTypes = call.getArray("read", String.self) else {
            call.reject("Parámetros inválidos: se requiere array 'read'")
            return
        }
        
        var typesToRead: Set<HKObjectType> = []
        
        for typeString in readTypes {
            switch typeString {
            case "bodyTemperature":
                if let type = HKObjectType.quantityType(forIdentifier: .bodyTemperature) {
                    typesToRead.insert(type)
                }
            case "sleepAnalysis":
                if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
                    typesToRead.insert(type)
                }
            case "stepCount":
                if let type = HKObjectType.quantityType(forIdentifier: .stepCount) {
                    typesToRead.insert(type)
                }
            case "activeEnergyBurned":
                if let type = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
                    typesToRead.insert(type)
                }
            case "heartRate":
                if let type = HKObjectType.quantityType(forIdentifier: .heartRate) {
                    typesToRead.insert(type)
                }
            case "heartRateVariabilitySDNN":
                if let type = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
                    typesToRead.insert(type)
                }
            case "oxygenSaturation":
                if let type = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) {
                    typesToRead.insert(type)
                }
            case "respiratoryRate":
                if let type = HKObjectType.quantityType(forIdentifier: .respiratoryRate) {
                    typesToRead.insert(type)
                }
            default:
                continue
            }
        }
        
        healthStore.requestAuthorization(toShare: nil, read: typesToRead) { success, error in
            if let error = error {
                call.reject("Error solicitando permisos: \(error.localizedDescription)")
                return
            }
            call.resolve([
                "granted": success
            ])
        }
    }
    
    /**
     * Check if authorization is granted
     */
    @objc func checkAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        
        guard let readTypes = call.getArray("read", String.self) else {
            call.reject("Parámetros inválidos: se requiere array 'read'")
            return
        }
        
        var typesToCheck: Set<HKObjectType> = []
        
        for typeString in readTypes {
            switch typeString {
            case "bodyTemperature":
                if let type = HKObjectType.quantityType(forIdentifier: .bodyTemperature) {
                    typesToCheck.insert(type)
                }
            case "sleepAnalysis":
                if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
                    typesToCheck.insert(type)
                }
            case "stepCount":
                if let type = HKObjectType.quantityType(forIdentifier: .stepCount) {
                    typesToCheck.insert(type)
                }
            default:
                continue
            }
        }
        
        var allGranted = true
        for type in typesToCheck {
            let status = healthStore.authorizationStatus(for: type)
            if status != .sharingAuthorized {
                allGranted = false
                break
            }
        }
        
        call.resolve([
            "granted": allGranted
        ])
    }
    
    /**
     * Query health data samples
     */
    @objc func querySampleType(_ call: CAPPluginCall) {
        guard let sampleTypeString = call.getString("sampleType"),
              let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("Parámetros requeridos: sampleType, startDate, endDate")
            return
        }
        
        let dateFormatter = ISO8601DateFormatter()
        guard let startDate = dateFormatter.date(from: startDateString),
              let endDate = dateFormatter.date(from: endDateString) else {
            call.reject("Formato de fecha inválido. Use ISO8601")
            return
        }
        
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        
        switch sampleTypeString {
        case "bodyTemperature":
            queryQuantityType(identifier: .bodyTemperature, predicate: predicate, call: call)
        case "stepCount":
            queryQuantityType(identifier: .stepCount, predicate: predicate, call: call)
        case "activeEnergyBurned":
            queryQuantityType(identifier: .activeEnergyBurned, predicate: predicate, call: call)
        case "heartRate":
            queryQuantityType(identifier: .heartRate, predicate: predicate, call: call)
        case "heartRateVariabilitySDNN":
            queryQuantityType(identifier: .heartRateVariabilitySDNN, predicate: predicate, call: call)
        case "oxygenSaturation":
            queryQuantityType(identifier: .oxygenSaturation, predicate: predicate, call: call)
        case "respiratoryRate":
            queryQuantityType(identifier: .respiratoryRate, predicate: predicate, call: call)
        case "sleepAnalysis":
            querySleepAnalysis(predicate: predicate, call: call)
        default:
            call.reject("Tipo de muestra no soportado: \(sampleTypeString)")
        }
    }
    
    /**
     * Query quantity type (temperature, steps, heart rate, etc.)
     */
    private func queryQuantityType(identifier: HKQuantityTypeIdentifier, predicate: NSPredicate, call: CAPPluginCall) {
        guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else {
            call.reject("Tipo de cantidad no disponible: \(identifier.rawValue)")
            return
        }
        
        let query = HKSampleQuery(sampleType: quantityType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            if let error = error {
                call.reject("Error consultando datos: \(error.localizedDescription)")
                return
            }
            
            guard let samples = samples as? [HKQuantitySample] else {
                call.resolve(["samples": []])
                return
            }
            
            var results: [[String: Any]] = []
            for sample in samples {
                var sampleDict: [String: Any] = [
                    "value": sample.quantity.doubleValue(for: self.getUnit(for: identifier)),
                    "startDate": ISO8601DateFormatter().string(from: sample.startDate),
                    "endDate": ISO8601DateFormatter().string(from: sample.endDate)
                ]
                
                if let sourceName = sample.sourceRevision.source.name as String? {
                    sampleDict["source"] = sourceName
                }
                
                results.append(sampleDict)
            }
            
            call.resolve(["samples": results])
        }
        
        healthStore.execute(query)
    }
    
    /**
     * Query sleep analysis
     */
    private func querySleepAnalysis(predicate: NSPredicate, call: CAPPluginCall) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.reject("Sleep analysis no disponible")
            return
        }
        
        let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            if let error = error {
                call.reject("Error consultando sueño: \(error.localizedDescription)")
                return
            }
            
            guard let samples = samples as? [HKCategorySample] else {
                call.resolve(["samples": []])
                return
            }
            
            var results: [[String: Any]] = []
            for sample in samples {
                let valueString: String
                switch sample.value {
                case HKCategoryValueSleepAnalysis.asleep.rawValue:
                    valueString = "ASLEEP.UNSPECIFIED"
                case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                    valueString = "ASLEEP.CORE"
                case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                    valueString = "ASLEEP.DEEP"
                case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                    valueString = "ASLEEP.REM"
                default:
                    valueString = "ASLEEP.UNSPECIFIED"
                }
                
                var sampleDict: [String: Any] = [
                    "value": valueString,
                    "startDate": ISO8601DateFormatter().string(from: sample.startDate),
                    "endDate": ISO8601DateFormatter().string(from: sample.endDate)
                ]
                
                if let sourceName = sample.sourceRevision.source.name as String? {
                    sampleDict["source"] = sourceName
                }
                
                results.append(sampleDict)
            }
            
            call.resolve(["samples": results])
        }
        
        healthStore.execute(query)
    }
    
    /**
     * Get unit for quantity type
     */
    private func getUnit(for identifier: HKQuantityTypeIdentifier) -> HKUnit {
        switch identifier {
        case .bodyTemperature:
            return HKUnit.degreeCelsius()
        case .stepCount:
            return HKUnit.count()
        case .activeEnergyBurned:
            return HKUnit.kilocalorie()
        case .heartRate:
            return HKUnit(from: "count/min")
        case .heartRateVariabilitySDNN:
            return HKUnit.secondUnit(with: .milli)
        case .oxygenSaturation:
            return HKUnit.percent()
        case .respiratoryRate:
            return HKUnit(from: "count/min")
        default:
            return HKUnit.count()
        }
    }
}

